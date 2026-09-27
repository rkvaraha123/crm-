# Engineering Quality Gates

RK Varaha CRM is a customer-facing multi-tenant product. Reliability is achieved through repeatable controls, not by assuming the code is bug-free.

## Definition of done

A change is not complete until all applicable gates pass.

### Required for every pull request

1. install from lockfile with `npm ci`
2. Prisma client generation
3. Prisma schema validation
4. TypeScript compilation
5. ESLint
6. formatting check
7. unit tests
8. integration tests for data/auth changes
9. build API, web and worker workspaces
10. dependency/security review
11. no tracked secrets
12. migration review when schema changes
13. tenant-isolation regression tests for tenant-owned data
14. authorization regression tests for protected operations

## Critical regression suites

### Tenant isolation
For every tenant-owned module test:
- tenant A cannot read tenant B
- tenant A cannot update tenant B
- tenant A cannot delete/archive tenant B
- IDs supplied in body/query cannot change trusted tenant context
- concurrent requests do not leak AsyncLocalStorage/request context

### Authorization
Test:
- unauthenticated -> denied
- inactive user -> denied
- inactive membership -> denied
- missing permission -> denied
- OWN cannot access another owner's record
- TEAM is bounded to the permitted team
- ORGANIZATION is bounded to the active tenant
- platform roles cannot accidentally be assigned through tenant APIs

### Database
Test:
- tenant-local uniqueness
- FK integrity
- invalid state transitions
- transaction rollback
- idempotent retry where supported
- migration deploy against an empty database
- migration deploy against a representative previous schema

### API
Test:
- DTO unknown-field rejection
- pagination bounds
- stable sort
- malformed UUIDs/enums
- duplicate/conflict behavior
- sanitized 500 responses
- correlation/request ID

## CRM-specific invariants

Examples:
- lead conversion is atomic
- retrying conversion does not duplicate contact/company/deal
- moving a deal writes one stage-change activity
- archived records cannot be mutated through ordinary endpoints
- tasks cannot reference records from another tenant
- activities cannot reference records from another tenant
- company/contact/deal associations are same-tenant
- owner/team assignments must refer to active valid tenant members

## Frontend release gates

Critical user journeys need browser tests:
- sign in / sign out
- organization selection
- contacts list/create/edit/archive
- companies list/create/edit
- lead creation/qualification/conversion
- deal stage movement
- task create/complete
- permissions hide actions **and** API denies unauthorized calls
- session expiry handling
- server error recovery

Use Playwright for a small number of high-value end-to-end flows rather than brittle tests for every pixel.

## Performance baseline

Performance tests should reflect real endpoints and a seeded representative dataset.

Track at least:
- API p50/p95/p99 latency
- DB query latency
- error rate
- concurrent request behavior
- slow queries
- worker queue delay
- frontend core route loading

Do not claim support for a concurrency target solely from mocked or in-memory tests.

## Deployment gates

Production deploy:
1. approved PR
2. green CI
3. immutable image
4. migration plan
5. backup policy satisfied
6. deploy
7. health/readiness check
8. authenticated smoke test
9. key CRM workflow smoke test
10. observe error/latency metrics

## Incident/recovery expectations

Maintain:
- documented backup schedule
- restore procedure
- periodic restore test
- rollback procedure
- migration recovery plan
- failed-job replay procedure
- credential rotation procedure
- security incident runbook

## Branch policy

Recommended:
- `main` protected
- changes through pull requests
- required CI checks
- no direct force push
- squash merge or linear history
- Dependabot/security updates reviewed normally
- production tags/releases created from tested `main`

## Reliability principle

No team can guarantee zero defects. The target is to make defects difficult to introduce, easy to detect, contained when they occur, observable in production, and recoverable without customer data loss.
