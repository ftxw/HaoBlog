"use client";

import { getLikeState, type LikeTargetType } from "@/app/lib/api-client/like";

const MAX_CONCURRENCY = 6;

const ANONYMOUS = "anon";

interface LikeState {
  likes: number;
  liked: boolean;
}

const cache = new Map<string, LikeState>();
const inflight = new Map<string, Promise<LikeState>>();

let active = 0;
const queue: Array<() => void> = [];

function cacheKey(
  targetType: LikeTargetType,
  targetId: string,
  userId?: string
): string {
  return `${userId || ANONYMOUS}:${targetType}:${targetId}`;
}

function acquire(): Promise<void> {
  if (active < MAX_CONCURRENCY) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    queue.push(() => {
      active += 1;
      resolve();
    });
  });
}

function release(): void {
  active -= 1;
  const next = queue.shift();
  if (next) next();
}

export function peekLikeState(
  targetType: LikeTargetType,
  targetId: string,
  userId?: string
): LikeState | undefined {
  return cache.get(cacheKey(targetType, targetId, userId));
}

export function fetchLikeState(
  targetType: LikeTargetType,
  targetId: string,
  userId?: string,
  force = false
): Promise<LikeState> {
  const key = cacheKey(targetType, targetId, userId);

  if (!force) {
    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const task = (async () => {
    await acquire();
    try {
      const state = await getLikeState(targetType, targetId);
      cache.set(key, state);
      return state;
    } finally {
      release();
    }
  })();

  inflight.set(key, task);
  task.then(
    () => inflight.delete(key),
    () => inflight.delete(key)
  );
  return task;
}

export function primeLikeState(
  targetType: LikeTargetType,
  targetId: string,
  userId: string | undefined,
  state: LikeState
): void {
  cache.set(cacheKey(targetType, targetId, userId), state);
}

export function resetLikeStateCache(): void {
  cache.clear();
  inflight.clear();
}
