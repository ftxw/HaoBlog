type Entry = { promise: Promise<unknown>; expiresAt: number };

const inflight = new Map<string, Entry>();

/** 同一 key 的并发调用合并成一次执行（进程内去重）。 */
export function singleFlight<T>(
  key: string,
  fn: () => Promise<T>,
  staleMs = 30_000
): Promise<T> {
  const existing = inflight.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.promise as Promise<T>;
  }

  const promise = fn().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, { promise, expiresAt: Date.now() + staleMs });
  return promise;
}
