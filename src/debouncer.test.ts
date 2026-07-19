import { Debouncer } from './debouncer';

describe('Debouncer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('runs the action once after the quiet window', async () => {
    const debouncer = new Debouncer(500);
    const action = jest.fn().mockResolvedValue('done');

    const promise = debouncer.schedule('key', action);
    expect(action).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500);
    await expect(promise).resolves.toBe('done');
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst on the same key into a single run of the latest action', async () => {
    const debouncer = new Debouncer(500);
    const first = jest.fn().mockResolvedValue(1);
    const second = jest.fn().mockResolvedValue(2);
    const third = jest.fn().mockResolvedValue(3);

    const p1 = debouncer.schedule('key', first);
    jest.advanceTimersByTime(200);
    const p2 = debouncer.schedule('key', second);
    jest.advanceTimersByTime(200);
    const p3 = debouncer.schedule('key', third);

    jest.advanceTimersByTime(500);
    await Promise.resolve();

    // Only the last action runs...
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(third).toHaveBeenCalledTimes(1);
    // ...and every caller shares its result.
    await expect(p1).resolves.toBe(3);
    await expect(p2).resolves.toBe(3);
    await expect(p3).resolves.toBe(3);
  });

  it('keeps distinct keys independent', async () => {
    const debouncer = new Debouncer(500);
    const a = jest.fn().mockResolvedValue('a');
    const b = jest.fn().mockResolvedValue('b');

    const pa = debouncer.schedule('a', a);
    const pb = debouncer.schedule('b', b);

    jest.advanceTimersByTime(500);
    await Promise.all([pa, pb]);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    await expect(pa).resolves.toBe('a');
    await expect(pb).resolves.toBe('b');
  });

  it('reports pending state and clears it after firing', async () => {
    const debouncer = new Debouncer(500);
    const promise = debouncer.schedule('key', jest.fn().mockResolvedValue(undefined));

    expect(debouncer.isPending('key')).toBe(true);
    expect(debouncer.isPending('other')).toBe(false);

    jest.advanceTimersByTime(500);
    await promise;

    expect(debouncer.isPending('key')).toBe(false);
  });

  it('rejects the shared promise when the action throws, without wedging the key', async () => {
    const debouncer = new Debouncer(500);
    const failing = jest.fn().mockRejectedValue(new Error('boom'));

    const p1 = debouncer.schedule('key', failing);
    jest.advanceTimersByTime(500);
    await expect(p1).rejects.toThrow('boom');

    // The key is free again and can be rescheduled.
    expect(debouncer.isPending('key')).toBe(false);
    const ok = jest.fn().mockResolvedValue('ok');
    const p2 = debouncer.schedule('key', ok);
    jest.advanceTimersByTime(500);
    await expect(p2).resolves.toBe('ok');
  });

  it('flush runs the pending action immediately', async () => {
    const debouncer = new Debouncer(500);
    const action = jest.fn().mockResolvedValue('flushed');

    const promise = debouncer.schedule('key', action);
    await debouncer.flush('key');

    expect(action).toHaveBeenCalledTimes(1);
    await expect(promise).resolves.toBe('flushed');
    expect(debouncer.isPending('key')).toBe(false);
  });

  it('cancelAll rejects pending promises and clears timers', async () => {
    const debouncer = new Debouncer(500);
    const action = jest.fn().mockResolvedValue('never');
    const promise = debouncer.schedule('key', action);

    debouncer.cancelAll();

    await expect(promise).rejects.toThrow('cancelled');
    expect(debouncer.isPending('key')).toBe(false);
    jest.advanceTimersByTime(500);
    expect(action).not.toHaveBeenCalled();
  });
});
