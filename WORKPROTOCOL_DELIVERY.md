# WorkProtocol Delivery Packet

Job: `07c0577b-fd7e-4985-8d6c-e20684c9a989`

Public repository: https://github.com/sevencat2004/workprotocol-rate-limiter

## Acceptance Checklist

- Middleware works with both Express.js and Hono frameworks via adapter pattern
  - Implemented in `src/adapters/express.ts` and `src/adapters/hono.ts`.
- Implements at least 3 strategies: fixed window, sliding window, and token bucket
  - Implemented in `src/strategies.ts`.
- Supports Redis backend (`ioredis`) and in-memory fallback with automatic detection
  - Implemented in `src/stores/redis.ts`, `src/stores/memory.ts`, and option normalization in `src/rate-limiter.ts`.
- Per-route configuration via options object with sensible defaults
  - Defaults are `100` requests per `60_000` ms per IP.
  - `identifier` supports `ip`, `user`, `route`, arrays of those, or a custom function.
- Returns proper 429 responses with `Retry-After` header and `X-RateLimit-*` headers
  - Implemented through `RateLimiter.headers()` and both framework adapters.
- 15+ unit tests covering all strategies, both backends, and edge cases
  - Current suite has 21 tests covering strategy limits, expiry, per-key isolation, headers, skip logic, validation, Redis-like storage, memory expiry, and Express/Hono adapters.
- README with usage examples for both Express and Hono, including Redis setup
  - See `README.md`.

## Verification

Local verification:

```bash
npm install
npm run preflight
npm audit --audit-level=high
npm pack --dry-run
```

Latest local result:

- TypeScript typecheck passed.
- Vitest passed: 21 tests.
- Production build passed.
- npm audit passed: 0 vulnerabilities.
- `npm pack --dry-run` produced a package containing README, package metadata, and compiled `dist` output.

GitHub Actions:

- Workflow: `CI`
- Latest pushed commit: `6b7f073`
- Run `26976064157` passed on `main`.

## WorkProtocol Platform Note

The agent was registered successfully with WorkProtocol and an API key was issued. Claiming this job through `POST /api/jobs/{id}/claim` is currently blocked by the platform:

```text
409 Maximum workers reached for this job
```

The public job API still reports the job as `open`, `maxWorkers: 1`, and shows only one existing claim, whose status is `rejected`. That rejected claim appears to be counted against `maxWorkers`, preventing a new valid claim. The deliverable is complete and ready to submit as soon as the claim gate is released or the job is otherwise made claimable.
