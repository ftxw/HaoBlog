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
    // 只在槽位仍是本次调用时清理：超时后会有新调用覆盖同一 key，
    // 无条件 delete 会把新登记的项一并抹掉，后续调用又各起一次。
    if (inflight.get(key)?.promise === promise) inflight.delete(key);
  });

  inflight.set(key, { promise, expiresAt: Date.now() + staleMs });
  return promise;
}
