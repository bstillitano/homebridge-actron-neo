# Serialized + Coalesced Command Pipeline — Design

**Date:** 2026-07-19
**Status:** Approved for planning

## Problem

Rapid successive changes from HomeKit do not all apply:

- Toggling several zones on/off in quick succession leaves only one (or some) applied.
- Dragging a temperature slider lands on a value *between* the start and the intended target.
- Turning the unit on/off right after a zone change applies inconsistently.

### Root causes

There are **two distinct mechanisms**, not one.

**1. Read-modify-write race on zones.** Every zone command rebuilds the entire
`EnabledZones` array. In `queApi.ts` `runCommand()` fetches fresh cloud state
(`getZoneStatuses()`), copies the array, flips a single index, then POSTs the whole
array. The Neo cloud is eventually consistent, so concurrent zone commands each read
stale state and clobber each other:

```
Cmd A (zone 0): reads [F,F,F] -> sends [T,F,F]
Cmd B (zone 1): reads [F,F,F] -> sends [F,T,F]   (A not yet reflected)
Cmd C (zone 2): reads [F,F,F] -> sends [F,F,T]
Final: [F,F,T]  -- only the last toggle survives
```

Because the toggles come from three different accessories, debouncing a single switch
cannot fix this. The array must be built from **local authoritative state**, and sends
must be **serialized**.

**2. Unordered concurrent sends.** HomeKit fires an `onSet` for every intermediate
slider value. Each becomes its own GET + POST with no ordering guarantee, so whichever
the cloud processes last wins — often not the final value. The same applies to any burst
of unrelated commands (mode, then temp, then power). This is a classic debounce problem.

## Goals

- Rapid multi-zone toggles all apply.
- Temperature slider lands on the final value.
- Bursts of mode / power / fan changes settle on the last intent.
- Fewer redundant API calls (one send per settled burst; no per-command status GET).

## Non-goals

- Changing the periodic refresh (`getStatus`) cadence or reconciliation model.
- Reworking auth/token handling or the retry logic in `manageApiRequest`.
- Offline queueing / persistence of commands across Homebridge restarts.

## Design

Two coordinated mechanisms.

### A. Serial command queue (in `QueApi`)

A private promise-chain ensures only one API request is in flight at a time and that
requests execute in strict enqueue order.

```ts
private commandChain: Promise<unknown> = Promise.resolve();

private enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = this.commandChain.then(task, task); // run regardless of prior outcome
  this.commandChain = run.catch(() => undefined); // an error must not wedge the chain
  return run;
}
```

All command sends in `runCommand()` go through `enqueue()`. This removes the
concurrency that makes ordering nondeterministic and makes local zone state safe to
mutate without races. It does **not** apply to `getStatus()` reads, which remain
independent.

### B. Debounce + coalesce layer (`src/debouncer.ts`, new)

A generic, pure, testable keyed trailing-edge debouncer. No HVAC knowledge lives here —
policy (keys, values, coalescing) lives in the HVAC layer.

Behaviour:

- `schedule(key, action, delayMs)` — (re)start the timer for `key`; when it fires, run
  the latest `action` registered for that key. A new call for the same key before firing
  replaces the pending action and restarts the timer.
- Distinct keys are independent timers.
- An error thrown by an `action` is caught/logged and must not prevent future scheduling
  for that key.
- A `flush(key?)` / `cancelAll()` affordance for clean shutdown and tests.

Two usage flavours in the HVAC layer:

- **Last-value-wins** — setpoints, mode, power, fan, away, quiet. Key encodes the target
  (`master:cool`, `master:heat`, `zone:3:heat`, `power`, `mode`, `fanMode`,
  `awayMode`, `quietMode`). Each `set*` overwrites the pending action with the newest
  value; only the final value is sent.
- **Coalesced zones** — all zone enable/disable share one key (`zones`) and mutate the
  shared local desired array (below). The single flushed action sends the whole array
  once via `SET_ENABLED_ZONES`.

Default window **500 ms**, configurable via `commandDebounceMs`.

### C. Local authoritative `enabledZones` (kills the RMW race)

`QueApi` holds `enabledZones: boolean[]`:

- Seeded and reconciled by `getStatus()` (which already parses
  `UserAirconSettings.EnabledZones`).
- Mutated locally by zone sends before flushing.
- Used to build zone commands — **no per-command GET**.

`getZoneStatuses()` (and its `// TODO - Shouldn't need to make this call` at
`queApi.ts:423`) is **deleted**. In `queCommands.ts`, `ZONE_ENABLE` and `ZONE_DISABLE`
collapse into a single `SET_ENABLED_ZONES(array)` builder that emits
`UserAirconSettings.EnabledZones`.

### D. Optimistic state + reconcile

Because `onSet` handlers now return before the debounced send fires, each `set*` method
in `HvacUnit` / `HvacZone`:

1. Updates its local state immediately (HomeKit getters reflect intent),
2. Schedules the debounced/coalesced send through the debouncer → serial queue,
3. Returns the optimistic value.

On send failure (`CommandResult.FAILURE` or `API_ERROR`), it triggers `getStatus()` to
reconcile true state back to HomeKit — the same recovery path the code already uses on
failure today. The periodic hard refresh remains the backstop for drift.

## Components

| File | Change |
|---|---|
| `src/debouncer.ts` | **New.** Generic keyed trailing-edge debounce + coalesce. Pure timing logic. |
| `src/queApi.ts` | Add serial promise-chain wrapping all sends; add local `enabledZones`; delete `getZoneStatuses()`; `runCommand()` builds zone commands from local state. |
| `src/queCommands.ts` | Replace `ZONE_ENABLE` / `ZONE_DISABLE` with `SET_ENABLED_ZONES(array)`. |
| `src/hvac.ts` | Route setpoint / mode / power / fan / away / quiet sends through the debouncer; optimistic update + reconcile-on-failure. |
| `src/hvacZone.ts` | Route zone enable/disable + zone setpoints through the debouncer (zones coalesced on key `zones`, mutating shared local array). |
| `src/platform.ts` | Read `commandDebounceMs` (default 500) and pass to `HvacUnit`. |
| `config.schema.json` | Add `commandDebounceMs` field (default 500). |
| `README.md` | Document `commandDebounceMs`. |

Wiring of the debouncer instance: created once (owned by `HvacUnit`, constructed with the
configured window) and shared by the master unit and all zone instances so the `zones`
key coalesces across accessories.

## Data flow

**Drag master cool slider:**
`onSet` ×N → optimistic temp set + reschedule key `master:cool` → 500 ms idle →
one `COOL_SET_POINT(final)` → serial queue → single POST.

**Toggle 3 zones fast:**
`onSet` ×3 (3 accessories) → each mutates shared `enabledZones` + reschedules key
`zones` → 500 ms idle → one `SET_ENABLED_ZONES([T,T,T])` → serial queue → single POST.
All three stick.

**Unit off right after a zone change:**
Zone flush on key `zones` and power on key `power` fire independently but both pass
through the serial queue, so they apply in order without interleaving.

## Error handling

- Serial chain catches errors so one failed send never wedges the queue.
- Debouncer catches errors thrown by actions so a failed flush never blocks future
  scheduling for that key.
- Send failure → optimistic state is corrected by a `getStatus()` reconcile.
- Existing `manageApiRequest` retry/backoff and token refresh are unchanged.

## Testing

- `debouncer.test.ts` (fake timers): burst → one call; latest action wins; distinct keys
  isolated; action error does not wedge the key; `flush`/`cancelAll` behave.
- Serial queue: strict ordering; one-at-a-time (no overlap); an error does not break the
  chain for subsequent commands.
- Zone coalescing: three toggles across zones → one `SET_ENABLED_ZONES` with all bits
  set; **no** `getZoneStatuses` call; local array seeded from `getStatus`.
- Setpoint debounce: N values on one key → only the last is sent.
- Optimistic + reconcile: getter returns intended value immediately; a failed send
  triggers a `getStatus()` reconcile.
- Update existing `queApi.test.ts`, `hvac.test.ts`, `hvacZone.test.ts` for the removed
  GET, the new `SET_ENABLED_ZONES` shape, and the debounced/optimistic behaviour.

## Config

`commandDebounceMs` — integer, default `500`. Quiet window before a settled burst is
sent. Lower = snappier but less coalescing; higher = safer under very jittery bursts but
a touch laggier on a single deliberate change.

## Open questions

None outstanding. `getZoneStatuses()` removal, the `ZONE_ENABLE/DISABLE` → single
`SET_ENABLED_ZONES` collapse, and extending debounce/optimistic handling to
modes/power/fan were confirmed during brainstorming.
