type CacheEntry = { data: unknown; expiresAt: number };

const store = new Map<string, CacheEntry>();

const MAX_KEYS_PER_NAMESPACE = 200;

function fullKey(namespace: string, key: string) {
  return `${namespace}::${key}`;
}

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

  if (store.has(k)) store.delete(k);

  const prefix = `${namespace}::`;
  let count = 0;
  let lruKey: string | null = null;
  let expiredKey: string | null = null;

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
