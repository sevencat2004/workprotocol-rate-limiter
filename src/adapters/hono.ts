import { createRateLimiter } from "../rate-limiter.js";
import type { RateLimiterOptions } from "../types.js";

interface HonoContextLike {
  req: {
    method: string;
    path: string;
    header(name: string): string | undefined;
  };
  get?(name: string): unknown;
  header(name: string, value: string): void;
  json(body: unknown, status?: number): Response;
  text(body: string, status?: number): Response;
}

type HonoNext = () => Promise<unknown>;

export function honoRateLimiter(options: RateLimiterOptions = {}) {
  const limiter = createRateLimiter(options);

  return async function rateLimitMiddleware(c: HonoContextLike, next: HonoNext): Promise<unknown> {
    const result = await limiter.check({
      ip: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("cf-connecting-ip"),
      userId: options.getUserId?.(c) ?? asString(c.get?.("userId")),
      route: c.req.path,
      method: c.req.method
    });

    for (const [name, value] of Object.entries(limiter.headers(result))) {
      c.header(name, value);
    }

    if (result.allowed) {
      return next();
    }

    const body = limiter.responseBody();
    return typeof body === "string" ? c.text(body, 429) : c.json(body, 429);
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
