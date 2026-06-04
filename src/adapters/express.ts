import { createRateLimiter } from "../rate-limiter.js";
import type { RateLimiterOptions } from "../types.js";

interface ExpressRequestLike {
  ip?: string;
  method?: string;
  route?: { path?: string };
  path?: string;
  originalUrl?: string;
  user?: { id?: string };
}

interface ExpressResponseLike {
  setHeader(name: string, value: string): void;
  status(code: number): ExpressResponseLike;
  json(body: unknown): unknown;
  send(body: unknown): unknown;
}

type NextFunction = () => unknown;

export function expressRateLimiter(options: RateLimiterOptions = {}) {
  const limiter = createRateLimiter(options);

  return async function rateLimitMiddleware(
    req: ExpressRequestLike,
    res: ExpressResponseLike,
    next: NextFunction
  ): Promise<unknown> {
    const result = await limiter.check({
      ip: req.ip,
      userId: options.getUserId?.(req) ?? req.user?.id,
      route: req.route?.path ?? req.path ?? req.originalUrl,
      method: req.method
    });

    for (const [name, value] of Object.entries(limiter.headers(result))) {
      res.setHeader(name, value);
    }

    if (result.allowed) {
      return next();
    }

    const body = limiter.responseBody();
    return typeof body === "string" ? res.status(429).send(body) : res.status(429).json(body);
  };
}
