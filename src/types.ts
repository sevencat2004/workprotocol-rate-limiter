export type RateLimitStrategy = "fixed-window" | "sliding-window" | "token-bucket";

export type IdentifierSource = "ip" | "user" | "route";

export interface RateLimitContext {
  ip?: string;
  userId?: string;
  route?: string;
  method?: string;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  key: string;
  strategy: RateLimitStrategy;
}

export interface RateLimitStore {
  increment(key: string, ttlMs: number): Promise<number>;
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  zAdd?(key: string, score: number, member: string, ttlMs: number): Promise<void>;
  zRemoveRangeByScore?(key: string, min: number, max: number): Promise<void>;
  zCount?(key: string): Promise<number>;
}

export interface RedisLikeClient {
  incr(key: string): Promise<number> | number;
  pexpire(key: string, ttlMs: number): Promise<unknown> | unknown;
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string, mode?: string, ttlMs?: number): Promise<unknown> | unknown;
  zadd(key: string, score: number, member: string): Promise<unknown> | unknown;
  zremrangebyscore(key: string, min: number, max: number): Promise<unknown> | unknown;
  zcard(key: string): Promise<number> | number;
}

export interface RateLimiterOptions {
  limit?: number;
  windowMs?: number;
  strategy?: RateLimitStrategy;
  store?: RateLimitStore;
  redis?: RedisLikeClient;
  keyPrefix?: string;
  identifier?: IdentifierSource | IdentifierSource[] | ((context: RateLimitContext) => string);
  getUserId?: (requestLike: unknown) => string | undefined;
  skip?: (context: RateLimitContext) => boolean | Promise<boolean>;
  message?: string | Record<string, unknown>;
  standardHeaders?: boolean;
}

export interface NormalizedOptions {
  limit: number;
  windowMs: number;
  strategy: RateLimitStrategy;
  store: RateLimitStore;
  keyPrefix: string;
  identifier: NonNullable<RateLimiterOptions["identifier"]>;
  skip?: RateLimiterOptions["skip"];
  message: string | Record<string, unknown>;
  standardHeaders: boolean;
}
