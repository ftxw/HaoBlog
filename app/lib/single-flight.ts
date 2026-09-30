
type Entry = { promise: Promise<unknown>; expiresAt: number };

const inflight = new Map<string, Entry>();

/**
 * 同一 key 的并发调用合并成一次执行（**进程内**去重）。
 *
 * 正常路径上条目在 promise settle 时就被删掉了（见下面的 `finally`），所以
 * `staleMs` 并**不是**「结果的缓存时长」—— 它是一道**防悬挂保险**：
 * 若某个 `fn()` 永远不 settle（上游不回包且没超时），条目会永久留在 Map 里，
 * 后续所有同 key 调用都会拿到那个永不 resolve 的 promise，等于把这个 key 冻死。
 * 超时后条目作废，下一次调用会重新发起。
 *
 * ⚠️ 它和 `next/cache` 的 `unstable_cache` 不是一回事：后者是跨实例、跨冷启动的
 * Data Cache；本函数只在该函数实例内生效，用来把同一实例上同时到达的请求收拢成一次回源
 * （Data Cache 要等第一次回源结束才写入，不合并的话并发请求会各查一次库）。
 */
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
