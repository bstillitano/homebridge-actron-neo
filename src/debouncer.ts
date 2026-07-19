// A generic, keyed, trailing-edge debouncer.
//
// Calls made under the same key within the debounce window are collapsed: only the
// most recently scheduled action for that key runs when the window goes quiet. Every
// caller that scheduled under the key while it was pending receives the same shared
// promise, resolving (or rejecting) with the result of that single run. Distinct keys
// are fully independent.
//
// This lets a burst of HomeKit `onSet` events (a slider drag, a rapid multi-zone
// toggle) coalesce into a single outgoing command while every awaiting handler still
// gets a real result back.

interface PendingEntry {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  action: () => Promise<unknown>;
  timer: NodeJS.Timeout;
}

export class Debouncer {
  private readonly entries = new Map<string, PendingEntry>();

  constructor(private readonly delayMs: number) {}

  // Schedule (or reschedule) an action under `key`. Restarts the quiet window and
  // replaces any previously pending action for the key with this one (last write wins).
  // An optional `delayMs` overrides the default window for this key (a key always uses a
  // consistent command type, so the delay stays stable across reschedules).
  // Returns a promise shared by all callers scheduling under the key this window.
  schedule<T>(key: string, action: () => Promise<T>, delayMs: number = this.delayMs): Promise<T> {
    const existing = this.entries.get(key);
    if (existing) {
      clearTimeout(existing.timer);
      existing.action = action as () => Promise<unknown>;
      existing.timer = setTimeout(() => this.flush(key), delayMs);
      return existing.promise as Promise<T>;
    }

    let resolve!: (value: unknown) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    const timer = setTimeout(() => this.flush(key), delayMs);
    this.entries.set(key, { promise, resolve, reject, action: action as () => Promise<unknown>, timer });
    return promise as Promise<T>;
  }

  // Whether a key currently has a pending (not yet fired) action.
  isPending(key: string): boolean {
    return this.entries.has(key);
  }

  // Run the pending action for `key` immediately, resolving/rejecting its shared promise.
  // Safe to call when nothing is pending (no-op).
  async flush(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timer);
    this.entries.delete(key);
    try {
      const result = await entry.action();
      entry.resolve(result);
    } catch (error) {
      entry.reject(error);
    }
  }

  // Cancel every pending timer without running the actions. Their shared promises are
  // rejected so awaiting callers do not hang. Intended for shutdown/teardown.
  cancelAll(): void {
    for (const [key, entry] of this.entries) {
      clearTimeout(entry.timer);
      this.entries.delete(key);
      entry.reject(new Error(`Debounced action for "${key}" was cancelled`));
    }
  }
}
