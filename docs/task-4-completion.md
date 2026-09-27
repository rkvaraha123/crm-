# Task 4 — Enterprise RBAC completion

Task 4 implements PostgreSQL-authoritative RBAC on top of the Task 3 Keycloak identity layer.

## Implemented

- Effective permissions are calculated as the union of permissions from the authenticated user's valid roles inside the verified organization context.
- `PermissionGuard`, `RequirePermissions`, and `RequireAnyPermission` provide reusable backend authorization enforcement.
- Organization, membership, team, role, role-assignment, and permission-catalog endpoints are protected by server-side permissions.
- Organization role administration supports custom roles while protecting reserved/system roles.
- Role replacement and permission replacement use transactions and validate tenant scope and privilege boundaries.
- Ordinary organization APIs cannot assign the global `SUPER_ADMIN` role.
- Self-elevation, cross-tenant role use, foreign-member role assignment, and permission escalation beyond the actor's effective permissions are rejected.
- `/api/v1/me` remains a self-service authenticated endpoint; tenant effective permissions are exposed separately through the verified organization route.
- React authorization state is permission-based (`can(permission)`) and is only a UX layer; the API remains authoritative.
- Authorization-sensitive changes emit structured authorization audit events. Durable audit-log persistence is intentionally deferred to a later audit/reliability phase.

## Verification baseline

The supplied project previously reported successful Task 3 authentication regression, tenant-isolation regression, direct API authorization bypass tests, and 97 Task 4 tests. In this packaged revision, the API TypeScript build, web TypeScript typecheck, worker TypeScript build, ESLint, and Prettier checks were re-run successfully in the review environment. Full Vite/Vitest and Prisma-engine execution could not be re-run there because the uploaded `node_modules` came from Windows while the review environment is Linux and outbound dependency downloads are unavailable.

## Docker health hardening added

The API Compose healthcheck now uses `scripts/api-healthcheck.mjs` and an explicit `127.0.0.1` target instead of `localhost`. This avoids IPv4/IPv6 resolution ambiguity in Docker Desktop and keeps the probe independent of `curl`/`wget` packages.

An `OCI runtime exec failed` healthcheck still indicates a Docker runtime/container state failure. Recreate the API container or restart Docker Desktop; do not delete database volumes.
