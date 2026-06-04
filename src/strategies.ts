import type { NormalizedOptions, RateLimitResult } from "./types.js";

interface TokenBucketState {
  tokens: number;
  updatedAt: number;
}

export async function runStrategy(
  key: string,
  options: NormalizedOptions,
  now: number
): Promise<RateLimitResult> {
  if (options.strategy === "fixed-window") {
    return fixedWindow(key, options, now);
  }

  if (options.strategy === "sliding-window") {
    return slidingWindow(key, options, now);
  }

  return tokenBucket(key, options, now);
}

async function fixedWindow(
  key: string,
  options: NormalizedOptions,
  now: number
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / options.windowMs) * options.windowMs;
  const resetAt = windowStart + options.windowMs;
  const count = await options.store.increment(`${key}:${windowStart}`, resetAt - now);
  const allowed = count <= options.limit;

  return {
    allowed,
    limit: options.limit,
    remaining: Math.max(options.limit - count, 0),
    resetAt,
    retryAfter: allowed ? 0 : secondsUntil(resetAt, now),
    key,
    strategy: "fixed-window"
  };
}

async function slidingWindow(
  key: string,
  options: NormalizedOptions,
  now: number
): Promise<RateLimitResult> {
  if (!options.store.zAdd || !options.store.zRemoveRangeByScore || !options.store.zCount) {
    throw new Error("Sliding-window strategy requires sorted-set store methods.");
  }

  const windowStart = now - options.windowMs;
  await options.store.zRemoveRangeByScore(key, Number.NEGATIVE_INFINITY, windowStart);
  const before = await options.store.zCount(key);
  const allowed = before < options.limit;

  if (allowed) {
    await options.store.zAdd(key, now, `${now}:${Math.random()}`, options.windowMs);
  }

  const after = allowed ? before + 1 : before;

  return {
    allowed,
    limit: options.limit,
    remaining: Math.max(options.limit - after, 0),
    resetAt: now + options.windowMs,
    retryAfter: allowed ? 0 : secondsUntil(now + options.windowMs, now),
    key,
    strategy: "sliding-window"
  };
}

async function tokenBucket(
  key: string,
  options: NormalizedOptions,
  now: number
): Promise<RateLimitResult> {
  const refillRate = options.limit / options.windowMs;
  const state = (await options.store.get<TokenBucketState>(key)) ?? {
    tokens: options.limit,
    updatedAt: now
  };
  const elapsed = Math.max(now - state.updatedAt, 0);
  const refilled = Math.min(options.limit, state.tokens + elapsed * refillRate);
  const allowed = refilled >= 1;
  const nextTokens = allowed ? refilled - 1 : refilled;
  const msUntilNext = allowed ? 0 : Math.ceil((1 - nextTokens) / refillRate);
  const resetAt = now + Math.ceil((options.limit - nextTokens) / refillRate);

  await options.store.set<TokenBucketState>(
    key,
    { tokens: nextTokens, updatedAt: now },
    options.windowMs * 2
  );

  return {
    allowed,
    limit: options.limit,
    remaining: Math.floor(Math.max(nextTokens, 0)),
    resetAt,
    retryAfter: Math.max(Math.ceil(msUntilNext / 1000), 0),
    key,
    strategy: "token-bucket"
  };
}

function secondsUntil(resetAt: number, now: number): number {
  return Math.max(Math.ceil((resetAt - now) / 1000), 1);
}
