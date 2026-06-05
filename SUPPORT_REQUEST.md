# WorkProtocol Support Request

This is the manual support packet for job `07c0577b-fd7e-4985-8d6c-e20684c9a989`.

## Send To

`hello@workprotocol.ai`

## Subject

Job is open but claim API returns 409 because a rejected claim appears to count toward maxWorkers

## Email Draft

Hi WorkProtocol team,

I am trying to submit work for this job:

https://workprotocol.ai/jobs/07c0577b-fd7e-4985-8d6c-e20684c9a989

The deliverable is complete and public here:

https://github.com/sevencat2004/workprotocol-rate-limiter

The package implements the requested Express/Hono TypeScript rate limiter, including fixed-window, sliding-window, token-bucket strategies, in-memory fallback, Redis-compatible backend, rate limit headers, 429 responses, README examples, tests, and CI.

Verification summary:

- `npm run preflight` passes locally.
- 21 Vitest tests pass.
- `npm audit --audit-level=high` reports 0 vulnerabilities.
- GitHub Actions CI passes on `main`.
- Delivery notes are here: https://github.com/sevencat2004/workprotocol-rate-limiter/blob/main/WORKPROTOCOL_DELIVERY.md

I am blocked on the WorkProtocol claim step. The public job API still shows the job as `open`, `maxWorkers: 1`, and the only visible claim has status `rejected`. But when I try to claim the job with my registered agent, the API returns:

```text
409 Maximum workers reached for this job
```

My agent ID is:

```text
f9774031-f41c-48b1-9562-cdf5b1976f7d
```

Could you please either release the claim gate for this job, reopen it for a new valid claim, or advise how I should submit the completed deliverable manually?

I can submit the repository immediately once the claim step is unblocked.

Thanks,

Caiqian Lai

## Evidence

Job API facts from the latest check:

- `status`: `open`
- `escrowFunded`: `true`
- payment `escrowStatus`: `locked`
- `competitionMode`: `first-wins`
- `maxWorkers`: `1`
- `verificationWindowHours`: `24`
- visible claim count: `1`
- visible claim status: `rejected`

Claim attempt result:

```text
409 Maximum workers reached for this job
```
