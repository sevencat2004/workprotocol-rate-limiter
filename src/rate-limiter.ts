import { RedisStore } from "./stores/redis.js";
import { MemoryStore } from "./stores/memory.js";
import { runStrategy } from "./strategies.js";
import type {
  NormalizedOptions,
  RateLimitContext,
  RateLimiterOptions,
  RateLimitResult
} from "./types.js";

export class RateLimiter {
  private readonly options: NormalizedOptions;

  constructor(options: RateLimiterOptions = {}) {
    this.options = normalizeOptions(options);
  }

  async check(context: RateLimitContext = {}): Promise<RateLimitResult> {
    if (await this.options.skip?.(context)) {
      return {
        allowed: true,
        limit: this.options.limit,
        remaining: this.options.limit,
        resetAt: context.now ?? Date.now(),
        retryAfter: 0,
        key: "skipped",
        strategy: this.options.strategy
      };
    }

    const now = context.now ?? Date.now();
    const key = `${this.options.keyPrefix}:${resolveIdentifier(this.options.identifier, context)}`;
    return runStrategy(key, this.options, now);
  }

  headers(result: RateLimitResult): Record<string, string> {
    if (!this.options.standardHeaders) return {};
    const headers: Record<string, string> = {
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000))
    };
    if (!result.allowed) {
      headers["Retry-After"] = String(result.retryAfter);
    }
    return headers;
  }

  responseBody(): string | Record<string, unknown> {
    return this.options.message;
  }
}

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  return new RateLimiter(options);
}

export function normalizeOptions(options: RateLimiterOptions = {}): NormalizedOptions {
  const limit = options.limit ?? 100;
  const windowMs = options.windowMs ?? 60_000;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("limit must be a positive integer.");
  }
  if (!Number.isInteger(windowMs) || windowMs <= 0) {
    throw new Error("windowMs must be a positive integer.");
  }

  return {
    limit,
    windowMs,
    strategy: options.strategy ?? "fixed-window",
    store: options.store ?? (options.redis ? new RedisStore(options.redis) : new MemoryStore()),
    keyPrefix: options.keyPrefix ?? "rate-limit",
    identifier: options.identifier ?? ["ip"],
    skip: options.skip,
    message: options.message ?? { error: "Too Many Requests" },
    standardHeaders: options.standardHeaders ?? true
  };
}

export function resolveIdentifier(
  identifier: NormalizedOptions["identifier"],
  context: RateLimitContext
): string {
  if (typeof identifier === "function") {
    return sanitizePart(identifier(context));
  }

  const sources = Array.isArray(identifier) ? identifier : [identifier];
  const parts = sources.map((source) => {
    if (source === "ip") return context.ip ?? "unknown-ip";
    if (source === "user") return context.userId ?? "anonymous";
    return `${context.method ?? "ANY"}:${context.route ?? "unknown-route"}`;
  });

  return parts.map(sanitizePart).join(":");
}

function sanitizePart(part: string): string {
  return String(part).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9:._-]/g, "");
}
