
/**
 * 进程内 TTL 缓存 —— 只用于**单实例、可容忍不一致**的读穿透场景。
 *
 * 目前唯一调用方是 `app/lib/auth.ts`：缓存「Supabase access token → CurrentUser」
 * 的解析结果，避免同一用户在同一函数实例上连续请求时反复打 GoTrue。
 *
 * ## 结构
 *
 * 全部 namespace 共用**同一个 Map**（用 `namespace::key` 做前缀区分），
 * 但容量上限**按 namespace 分别计算**：淘汰时只删同前缀的 key，
 * 所以某个 namespace 再热也不会把别的挤出去。
 *
 * ## 淘汰策略：TTL + LRU
 *
 * `get` 命中会把条目搬到 Map 末尾（Map 保序 → 末尾即"最近使用"），`set` 同理；
 * 因此当某个 namespace 达到 `MAX_KEYS_PER_NAMESPACE` 时，被淘汰的是
 * **最久未被使用**的那条，而不是"最久以前写入"的那条。
 *
 * 这个区别对本项目是有实际意义的：auth 缓存的 key 是 token 的 sha256，
 * 一个**活跃**用户每次请求都会刷新它的访问时间，而只来过一次的用户不会 ——
 * 纯 FIFO 会优先保住后者、把前者挤掉，对"最需要缓存的那批 key"最不友好。
 * 被挤掉的代价有痕迹：下一个请求又要走一次 Supabase 上游校验。
 *
 * 淘汰时优先挑**已过期**的条目（等于白捡一个位置），没有过期的才按 LRU 动刀。
 */

type CacheEntry = { data: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();

const MAX_KEYS_PER_NAMESPACE = 200;

function fullKey(namespace: string, key: string) {
  return `${namespace}::${key}`;
}

/** 把条目移到 Map 末尾：Map 迭代遵循插入顺序，于是末尾即"最近使用"。 */
function touch(k: string, entry: CacheEntry): void {
  store.delete(k);
  store.set(k, entry);
}

export function memoryCacheGet<T>(namespace: string, key: string): T | undefined {
  const k = fullKey(namespace, key);
  const entry = store.get(k);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(k);
    return undefined;
  }
  touch(k, entry);
  return entry.data as T;
}

export function memoryCacheSet<T>(namespace: string, key: string, data: T, ttlMs = 60_000): void {
  if (data === undefined) return;
  const k = fullKey(namespace, key);
  const now = Date.now();

  // 已存在就先删：让下面的 set 把它挪到末尾，避免"更新过的条目仍待在淘汰位"。
  if (store.has(k)) store.delete(k);

  const prefix = `${namespace}::`;
  let count = 0;
  let lruKey: string | null = null; // 最久未使用（迭代顺序最靠前）
  let expiredKey: string | null = null; // 已过期，优先回收

  for (const [existing, entry] of store) {
    if (!existing.startsWith(prefix)) continue;
    count += 1;
    if (lruKey === null) lruKey = existing;
    if (expiredKey === null && now > entry.expiresAt) expiredKey = existing;
  }

  if (count >= MAX_KEYS_PER_NAMESPACE) {
    const victim = expiredKey ?? lruKey;
    if (victim !== null) store.delete(victim);
  }

  store.set(k, { data, expiresAt: now + ttlMs });
}

export function invalidateMemoryCache(namespace: string): void {
  const prefix = `${namespace}::`;
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
