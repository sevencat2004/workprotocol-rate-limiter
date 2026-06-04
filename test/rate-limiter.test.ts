import { describe, expect, it, vi } from "vitest";
import {
  createRateLimiter,
  expressRateLimiter,
  honoRateLimiter,
  MemoryStore,
  RedisStore,
  type RedisLikeClient
} from "../src/index.js";

describe("core rate limiter", () => {
  it("allows requests below the default fixed-window limit", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "1.1.1.1", now: 1 })).allowed).toBe(true);
  });

  it("blocks requests over the fixed-window limit", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(true);
    const blocked = await limiter.check({ ip: "1.1.1.1", now: 10 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(1);
  });

  it("resets fixed-window counts after window expiry", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "1.1.1.1", now: 1000 })).allowed).toBe(true);
  });

  it("isolates limits per IP", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "2.2.2.2", now: 0 })).allowed).toBe(true);
  });

  it("can key by route", async () => {
    const limiter = createRateLimiter({ limit: 1, identifier: ["ip", "route"] });
    expect((await limiter.check({ ip: "1.1.1.1", route: "/a", method: "GET", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "1.1.1.1", route: "/b", method: "GET", now: 0 })).allowed).toBe(true);
  });

  it("can key by user", async () => {
    const limiter = createRateLimiter({ limit: 1, identifier: "user" });
    expect((await limiter.check({ userId: "alice", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ userId: "bob", now: 0 })).allowed).toBe(true);
  });

  it("accepts a custom key generator", async () => {
    const limiter = createRateLimiter({ limit: 1, identifier: (ctx) => ctx.route ?? "none" });
    expect((await limiter.check({ route: "/a", now: 0 })).key).toContain("/a".replace("/", ""));
  });

  it("returns standard rate-limit headers", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    const result = await limiter.check({ ip: "1.1.1.1", now: 0 });
    expect(limiter.headers(result)).toEqual({
      "X-RateLimit-Limit": "1",
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": "1"
    });
  });

  it("adds Retry-After when blocked", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    await limiter.check({ ip: "1.1.1.1", now: 0 });
    const result = await limiter.check({ ip: "1.1.1.1", now: 0 });
    expect(limiter.headers(result)["Retry-After"]).toBe("1");
  });

  it("can skip selected contexts", async () => {
    const limiter = createRateLimiter({ limit: 1, skip: (ctx) => ctx.route === "/health" });
    expect((await limiter.check({ route: "/health" })).allowed).toBe(true);
    expect((await limiter.check({ route: "/health" })).remaining).toBe(1);
  });

  it("validates limit and window inputs", () => {
    expect(() => createRateLimiter({ limit: 0 })).toThrow("limit");
    expect(() => createRateLimiter({ windowMs: 0 })).toThrow("windowMs");
  });
});

describe("sliding-window strategy", () => {
  it("blocks only requests inside the rolling window", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, strategy: "sliding-window" });
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "1.1.1.1", now: 500 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "1.1.1.1", now: 700 })).allowed).toBe(false);
    expect((await limiter.check({ ip: "1.1.1.1", now: 1001 })).allowed).toBe(true);
  });

  it("does not add blocked requests to the sliding counter", async () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, strategy: "sliding-window" });
    await limiter.check({ ip: "1.1.1.1", now: 0 });
    const blocked = await limiter.check({ ip: "1.1.1.1", now: 1 });
    expect(blocked.remaining).toBe(0);
    expect((await limiter.check({ ip: "1.1.1.1", now: 1001 })).allowed).toBe(true);
  });
});

describe("token-bucket strategy", () => {
  it("spends burst tokens and then blocks", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, strategy: "token-bucket" });
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(true);
    expect((await limiter.check({ ip: "1.1.1.1", now: 0 })).allowed).toBe(false);
  });

  it("refills tokens over time", async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, strategy: "token-bucket" });
    await limiter.check({ ip: "1.1.1.1", now: 0 });
    await limiter.check({ ip: "1.1.1.1", now: 0 });
    expect((await limiter.check({ ip: "1.1.1.1", now: 500 })).allowed).toBe(true);
  });
});

describe("stores", () => {
  it("MemoryStore expires scalar values", async () => {
    vi.useFakeTimers();
    const store = new MemoryStore();
    await store.set("k", { ok: true }, 10);
    expect(await store.get("k")).toEqual({ ok: true });
    vi.advanceTimersByTime(11);
    expect(await store.get("k")).toBeUndefined();
    vi.useRealTimers();
  });

  it("RedisStore delegates to Redis-like commands", async () => {
    const data = new Map<string, string>();
    const client: RedisLikeClient = {
      incr: async (key) => {
        const next = String(Number(data.get(key) ?? "0") + 1);
        data.set(key, next);
        return Number(next);
      },
      pexpire: async () => "OK",
      get: async (key) => data.get(key) ?? null,
      set: async (key, value) => {
        data.set(key, value);
        return "OK";
      },
      zadd: async () => 1,
      zremrangebyscore: async () => 0,
      zcard: async () => 0
    };
    const store = new RedisStore(client);
    expect(await store.increment("k", 1000)).toBe(1);
    await store.set("json", { value: 42 }, 1000);
    expect(await store.get("json")).toEqual({ value: 42 });
  });
});

describe("framework adapters", () => {
  it("Express middleware calls next for allowed requests", async () => {
    const middleware = expressRateLimiter({ limit: 1 });
    const next = vi.fn();
    const res = mockExpressResponse();
    await middleware({ ip: "1.1.1.1", method: "GET", path: "/api" }, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.headers["X-RateLimit-Limit"]).toBe("1");
  });

  it("Express middleware returns 429 for blocked requests", async () => {
    const middleware = expressRateLimiter({ limit: 1, message: "slow down" });
    const req = { ip: "1.1.1.1", method: "GET", path: "/api" };
    await middleware(req, mockExpressResponse(), vi.fn());
    const res = mockExpressResponse();
    await middleware(req, res, vi.fn());
    expect(res.statusCode).toBe(429);
    expect(res.body).toBe("slow down");
  });

  it("Hono middleware calls next for allowed requests", async () => {
    const middleware = honoRateLimiter({ limit: 1 });
    const c = mockHonoContext();
    const next = vi.fn(async () => "ok");
    await middleware(c, next);
    expect(next).toHaveBeenCalledOnce();
    expect(c.headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("Hono middleware returns 429 for blocked requests", async () => {
    const middleware = honoRateLimiter({ limit: 1 });
    const c1 = mockHonoContext();
    await middleware(c1, vi.fn(async () => "ok"));
    const c2 = mockHonoContext();
    const response = await middleware(c2, vi.fn(async () => "ok"));
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(429);
  });
});

function mockExpressResponse() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    }
  };
}

function mockHonoContext() {
  return {
    headers: {} as Record<string, string>,
    req: {
      method: "GET",
      path: "/api",
      header(name: string) {
        return name.toLowerCase() === "x-forwarded-for" ? "1.1.1.1" : undefined;
      }
    },
    header(name: string, value: string) {
      this.headers[name] = value;
    },
    json(body: unknown, status = 200) {
      return Response.json(body, { status });
    },
    text(body: string, status = 200) {
      return new Response(body, { status });
    }
  };
}
