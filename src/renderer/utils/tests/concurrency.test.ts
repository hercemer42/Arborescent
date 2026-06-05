import { describe, it, expect, vi } from 'vitest';

import { mapWithConcurrency } from '../concurrency';

describe('mapWithConcurrency', () => {
  it('processes every item exactly once with its index', async () => {
    const seen: Array<[number, number]> = [];
    await mapWithConcurrency([10, 20, 30], 2, async (item, index) => {
      seen.push([item, index]);
    });

    expect(seen.sort((a, b) => a[1] - b[1])).toEqual([[10, 0], [20, 1], [30, 2]]);
  });

  it('never runs more than `limit` workers at once', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const release: Array<() => void> = [];
    const gates = items.map(() => new Promise<void>((resolve) => release.push(resolve)));

    let active = 0;
    let maxActive = 0;
    const done: number[] = [];

    const run = mapWithConcurrency(items, 3, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await gates[item];
      done.push(item);
      active -= 1;
    });

    await Promise.resolve();
    expect(active).toBe(3);

    release.forEach((resolve) => resolve());
    await run;

    expect(done).toHaveLength(10);
    expect(maxActive).toBe(3);
  });

  it('clamps the limit to the item count and still completes', async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    await mapWithConcurrency([1, 2], 10, worker);
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it('does nothing for an empty list', async () => {
    const worker = vi.fn().mockResolvedValue(undefined);
    await mapWithConcurrency([], 4, worker);
    expect(worker).not.toHaveBeenCalled();
  });

  it('propagates the first worker rejection but keeps draining the other lanes (not fail-stop)', async () => {
    const processed: number[] = [];
    const boom = new Error('worker failed');

    const run = mapWithConcurrency([0, 1, 2, 3], 2, async (item) => {
      if (item === 0) throw boom;
      processed.push(item);
    });

    await expect(run).rejects.toBe(boom);
    // The other lane is not cancelled — it keeps draining the remaining items.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([...processed].sort()).toEqual([1, 2, 3]);
  });
});
