type Entry = { promise: Promise<unknown>; expiresAt: number };

const inflight = new Map<string, Entry>();

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
    if (inflight.get(key)?.promise === promise) inflight.delete(key);
  });

  inflight.set(key, { promise, expiresAt: Date.now() + staleMs });
  return promise;
}
