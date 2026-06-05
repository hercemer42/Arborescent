// Runs `worker` over every item with at most `limit` in flight at once. Used to
// throttle the launch-time resume fan-out so spawning many claude --resume
// processes does not overwhelm the machine at the heaviest moment of startup.
//
// Error policy is the caller's. A rejecting worker rejects the returned promise
// with the first rejection, but the other in-flight lanes are NOT cancelled —
// they keep draining the remaining items detached (this is not fail-stop). Wrap
// the worker in try/catch for per-item isolation, or track your own signal to
// stop on first error.
export async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  let cursor = 0;
  const drain = async (): Promise<void> => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => drain()));
}
