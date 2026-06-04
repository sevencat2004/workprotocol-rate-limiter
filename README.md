# WorkProtocol Rate Limiter

Configurable TypeScript rate limiting middleware for Express and Hono. It supports fixed-window, sliding-window, and token-bucket strategies, with an in-memory store by default and a Redis-compatible store for shared deployments.

This package was built for the WorkProtocol job `07c0577b-fd7e-4985-8d6c-e20684c9a989`.

## Features

- Express middleware via `expressRateLimiter`
- Hono middleware via `honoRateLimiter`
- Three strategies: `fixed-window`, `sliding-window`, and `token-bucket`
- Default in-memory backend for local apps and tests
- Redis backend through an `ioredis`-compatible client
- Per-IP, per-user, per-route, or custom key generation
- Configurable windows and sensible defaults: `100` requests per `60_000` ms per IP
- Proper `429` responses with `Retry-After`
- Standard `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers
- TypeScript declarations and a focused test suite

## Install

```bash
npm install @sevencat/workprotocol-rate-limiter
```

For Redis-backed deployments:

```bash
npm install ioredis
```

## Express Usage

```ts
import express from "express";
import { expressRateLimiter } from "@sevencat/workprotocol-rate-limiter";

const app = express();

app.use(
  expressRateLimiter({
    limit: 100,
    windowMs: 60_000,
    strategy: "fixed-window",
    identifier: ["ip", "route"]
  })
);

app.get("/api/projects", (_req, res) => {
  res.json({ ok: true });
});

app.listen(3000);
```

## Hono Usage

```ts
import { Hono } from "hono";
import { honoRateLimiter } from "@sevencat/workprotocol-rate-limiter";

const app = new Hono();

app.use(
  "*",
  honoRateLimiter({
    limit: 100,
    windowMs: 60_000,
    strategy: "sliding-window",
    identifier: ["ip", "route"]
  })
);

app.get("/api/projects", (c) => c.json({ ok: true }));

export default app;
```

## Redis Setup

```ts
import Redis from "ioredis";
import { expressRateLimiter } from "@sevencat/workprotocol-rate-limiter";

const redis = new Redis(process.env.REDIS_URL);

app.use(
  expressRateLimiter({
    redis,
    strategy: "token-bucket",
    limit: 20,
    windowMs: 10_000,
    identifier: ["ip", "route"]
  })
);
```

You can also provide a custom store with the `RateLimitStore` interface when you need a different persistence layer.

## Per-User Limits

```ts
app.use(
  expressRateLimiter({
    identifier: "user",
    getUserId: (req) => {
      const request = req as { user?: { id?: string } };
      return request.user?.id;
    }
  })
);
```

## Custom Keys

```ts
const limiter = expressRateLimiter({
  identifier: (ctx) => `${ctx.method}:${ctx.route}:${ctx.ip}`
});
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `limit` | `100` | Maximum requests per window or bucket capacity. |
| `windowMs` | `60000` | Window duration in milliseconds. |
| `strategy` | `fixed-window` | `fixed-window`, `sliding-window`, or `token-bucket`. |
| `redis` | none | `ioredis`-compatible client. Used when no custom `store` is supplied. |
| `store` | `MemoryStore` | Custom storage adapter. |
| `identifier` | `["ip"]` | `ip`, `user`, `route`, an array of those, or a custom function. |
| `getUserId` | none | Adapter callback for pulling authenticated user IDs. |
| `message` | `{ error: "Too Many Requests" }` | Response body for blocked requests. |
| `standardHeaders` | `true` | Enables rate-limit and retry headers. |
| `skip` | none | Optional callback to bypass selected contexts. |

## Strategies

`fixed-window` uses a simple counter per time bucket. It is fast and works well for most APIs.

`sliding-window` tracks requests in a rolling window so bursts at bucket boundaries are smoothed out.

`token-bucket` allows short bursts and refills tokens over time.

## Development

```bash
npm install
npm run preflight
```

`npm run preflight` runs type checking, the full Vitest suite, and the production TypeScript build.
