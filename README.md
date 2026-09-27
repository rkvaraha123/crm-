# RK Varaha CRM

**Task 4 enterprise authorization is implemented.** See [authentication setup and operations](docs/authentication.md) and [RBAC architecture and administration](docs/authorization.md). The Task 2 tenant constraints and Task 3 Keycloak flow remain intact.

```sh
npm run auth:init-dev
docker compose -f compose.yaml up --build -d
docker compose -f compose.yaml exec api npm run db:seed
```

Use http://localhost:5173 for the application and http://localhost:8080 for Keycloak. Create/identify a verified Keycloak user and run `npm run auth:bootstrap-admin` with the explicit identity/email configuration documented above. No permanent human credentials are seeded. Protected routes require real bearer tokens; tenant routes also require a matching, membership-verified `X-Organization-Id` header and PostgreSQL-derived permissions.

Task 2 adds the PostgreSQL tenant and identity data foundation to the Phase 1 modular monolith. The React shell and public health endpoint remain available. No CRM business modules, CRM password storage, or queue infrastructure are included. Task 3 adds Keycloak and an isolated identity database.

## Requirements and project structure

Use Node.js 22.18+ (Node 22 recommended), npm 10+, and Docker Desktop with Linux containers. Local ports are **5173** (web), **3000** (API), and **5433** (PostgreSQL); PostgreSQL listens on 5432 inside Docker. The existing host port 5433 is preserved.

```text
apps/
  api/src/
    auth/                   JWT verification, verified linking, /me and server admin client
    authorization/          Effective permissions, guards, decorators and audit preparation
    common/database/        Prisma lifecycle service
    common/tenant/          Verified organization and membership context
    common/dto/             Bounded pagination
    health/                 Public liveness endpoint
    organizations/          Organization and membership controller/service/repository
    users/                  Global user controller/service/repository
    teams/                  Scoped team controller/service/repository
    roles/                  Scoped roles and default-role provisioning
    permissions/            Default permission catalog
  api/test/                 Real PostgreSQL/API integration suite
  web/                      React + Vite + Tailwind + Router + TanStack Query
  worker/                   Inactive future worker skeleton
prisma/
  schema.prisma             Eight models and four status enums
  migrations/               Versioned SQL, including custom tenant constraints
  seed.ts                   Idempotent development seed
scripts/integration-tests.mjs
prisma.config.ts
Dockerfile
compose.yaml
.env.example
```

## Start with Docker

For a new checkout, copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell; `cp .env.example .env` on macOS/Linux). Preserve an existing `.env`. Replace the password placeholder in POSTGRES_PASSWORD and DATABASE_URL. Use a URL-safe local password (letters, digits, hyphens, underscores) because Compose constructs the container URL from these settings. Never commit `.env` or put secrets in VITE_ variables.

```sh
npm run auth:init-dev
docker compose -f compose.yaml up --build -d
docker compose -f compose.yaml exec api npm run db:seed
```

The first command builds and starts CRM PostgreSQL, Keycloak, its dedicated database, API, and web. API startup runs `prisma migrate deploy` before starting NestJS. Seed is an explicit, development-only action. Source mounts support hot reload; rebuild after changing dependencies, Prisma models, or build configuration. The worker is intentionally not a running service.

- Web: http://localhost:5173
- Health: http://localhost:3000/api/v1/health returns exactly `{"status":"ok"}`.
- Protected routes require verified Keycloak bearer tokens and tenant context.

Compose uses the internal hostname `postgres:5432`, independently of the root DATABASE_URL used by local tools. An existing empty `docker-compose.yml` was left untouched; commands explicitly select `compose.yaml` to avoid ambiguity.

## Local Node development

For commands on the host, DATABASE_URL in your ignored `.env` must point to **localhost:5433**, with the same database/user/password as PostgreSQL. A URL containing `postgres:5432` works inside containers only. The pre-existing `.env` was preserved during this task.

```sh
npm ci
npm run db:generate
npm run auth:init-dev
docker compose -f compose.yaml up -d postgres keycloak
npm run db:migrate
npm run db:seed
npm run dev
```

If the full Compose stack is already running, stop its API and web before `npm run dev` to free their ports: `docker compose -f compose.yaml stop api web`.

The API loads `.env` through Node; Prisma config loads it for CLI commands. Vite reads the shared root env directory but only VITE_ values are browser-public. Its production build explicitly uses production React code despite the API's development NODE_ENV. API startup validates the PostgreSQL URL, port, environment, and exact CORS origin allowlist. Helmet, DTO validation, and centralized errors remain enabled.

## Database architecture

PostgreSQL is the source of truth. Prisma owns data access and versioned migrations. UUID primary keys use PostgreSQL `gen_random_uuid()`. All timestamps use timezone-aware precision 3. Models with mutable data have createdAt/updatedAt; joins and immutable permission catalog rows have createdAt.

| Model              | Purpose and constraints                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization       | Unique validated lowercase slug; ACTIVE/SUSPENDED/INACTIVE status                                                                                  |
| User               | Global user identity; unique normalized lowercase email; unique nullable identityProviderId; ACTIVE/INVITED/SUSPENDED/DISABLED; no password fields |
| OrganizationMember | Organization/user pair unique; INVITED/ACTIVE/SUSPENDED/REMOVED; joinedAt is null before joining and required for ACTIVE membership                |
| Team               | Required organization; name unique within that organization; ACTIVE/INACTIVE/ARCHIVED                                                              |
| Role               | Tenant scope, or the explicit global SUPER_ADMIN system role; scope is immutable                                                                   |
| Permission         | Unique permission key and description                                                                                                              |
| RolePermission     | Unique role/permission pair                                                                                                                        |
| UserRole           | Unique organization/user/role tuple; composite FK requires membership; tenant role scope enforced by a database trigger                            |

OrganizationMember is the association between a global User and a tenant. Teams are organization-owned; team membership is not part of this task. Role organizationId is nullable only for the system SUPER_ADMIN case. `isSystem` marks seeded built-in roles; it does not bypass tenant authorization.

### Database integrity and indexes

Foreign keys use RESTRICT for organization, user, membership, permission, and assigned-role deletion and for referenced-key updates. The sole CASCADE is Role -> RolePermission, removing mapping rows when an unassigned role is deliberately deleted. No deletion endpoints are exposed. Prefer status changes for deactivation.

Unique constraints cover organization slug, user email, nullable external identity, organization/user membership, organization/team name, organization/role name, permission key, role/permission, and organization/user/role. A partial unique index enforces global role-name uniqueness despite PostgreSQL NULL semantics.

Additional indexes cover Organization.status, User.status, membership (userId, status) and (organizationId, status), Team (organizationId, status), RolePermission.permissionId, UserRole.roleId, and UserRole.userId. Tenant-leading unique indexes also support organization queries without redundant single-column indexes.

Custom SQL in `20260920093922_init_tenant_foundation` enforces global-role restrictions, immutable role scope, normalized email, slug format, nonempty organization/team names, ACTIVE membership joinedAt, and matching tenant role assignments on INSERT and UPDATE. Do not replace migrations with `db push`: these custom checks/triggers are intentional and are not completely represented in Prisma schema syntax.

## Multi-tenancy and access policy

`IdentityProvider.resolve()` verifies Keycloak JWTs and transactionally resolves or links an eligible CRM user. It ignores client-supplied user IDs and does not derive CRM privileges from Keycloak roles. PostgreSQL is the sole authorization source.

The route organization UUID and X-Organization-Id header must match; neither is proof of access. The tenant guard validates active user, organization, and membership. The permission guard resolves the union of permissions from all applicable PostgreSQL roles and enforces explicit controller metadata. Only then does the interceptor initialize request context using AsyncLocalStorage. Tenant repositories derive their organization filter from that verified context; missing context fails closed.

Global SUPER_ADMIN assignments still require an active membership. They supply all catalog permissions through mappings and enable platform provisioning from PostgreSQL; they do not bypass authentication, account status, or tenant membership. Ordinary organization APIs cannot assign or mutate SUPER_ADMIN. The seed creates no users or admin credentials.

This is application-enforced isolation plus database-enforced relational integrity, not PostgreSQL row-level security. Future tenant data access must go through scoped repositories. Authentication, verified identity linking, transactional role administration, and granular permission enforcement are implemented. Invitation delivery remains deferred.

## REST endpoints

All routes use `/api/v1`. Controllers only validate and delegate to services/repositories.

| Method and path                                   | Required verified access               |
| ------------------------------------------------- | -------------------------------------- |
| GET /health                                       | Public                                 |
| POST /organizations                               | System administrator                   |
| GET /organizations/:id                            | Active membership + organizations.read |
| POST /users                                       | System administrator                   |
| GET /users/:id                                    | Self or system administrator           |
| POST /organizations/:organizationId/members       | Active membership + users.invite       |
| GET /organizations/:organizationId/members        | Active membership + users.read         |
| POST /organizations/:organizationId/teams         | Active membership + teams.create       |
| GET /organizations/:organizationId/teams          | Active membership + teams.read         |
| GET /organizations/:organizationId/roles          | Active membership + settings.read      |
| GET /organizations/:organizationId/me/permissions | Active membership                      |
| GET /organizations/:organizationId/permissions    | Active membership + settings.read      |
| POST/PATCH/DELETE organization roles              | Active membership + settings.update    |
| PUT organization role permissions                 | Active membership + settings.update    |
| GET organization user roles                       | settings.read + users.read             |
| PUT organization user roles                       | settings.update + users.update         |

There is no all-organizations or all-users endpoint. Member/team/role lists accept `limit` (1-100, default 50) and `offset` (0-1,000,000, default 0). Lists use stable ordering. Tenant role lists exclude global roles. User responses do not disclose identityProviderId, and client DTOs cannot set it.

DTOs enforce UUIDs, enums, email/slug formats, required fields, lengths, and reject unknown properties. User email is normalized. Malformed authorized requests return 400, unauthenticated requests 401, denied access 403, missing accessible user records 404, and duplicate/FK conflicts 409. Unknown or inaccessible organizations return 403 without tenant enumeration. Unexpected errors return a sanitized 500.

## Roles and seed

`npm run db:seed` runs one transaction and is idempotent. It creates **RK Varaha Development** (`rk-varaha-dev`), 37 permissions, seven organization-scoped roles, and one global SUPER_ADMIN. It creates no users, personal data, passwords, or identity credentials and refuses NODE_ENV=production.

| Role        | Default permissions                                                          |
| ----------- | ---------------------------------------------------------------------------- |
| SUPER_ADMIN | All 37; global catalog role, assignments remain membership-scoped            |
| ORG_ADMIN   | All 37 within its organization                                               |
| MANAGER     | Sales domains plus organization/user/team reads and report export            |
| TEAM_LEAD   | Sales domains plus user/team reads and report reads                          |
| SALES       | Contacts, companies, leads, deals, tasks actions                             |
| MARKETING   | Contact/lead read/create/update, company read, task read/create, report read |
| SUPPORT     | Contact/company reads, task read/create/update                               |
| VIEWER      | Read-only permissions, excluding settings and audit logs                     |

The exact catalog and mappings live in `apps/api/src/permissions/default-permissions.ts` and `apps/api/src/roles/default-roles.ts`. Permissions for future CRM resources do not create CRM tables or endpoints. Reruns add missing defaults without deleting custom mappings or resetting organization status. New organization creation provisions its seven roles and permission mappings in the same transaction; errors roll everything back.

## Migrations, inspection, and development reset

```sh
npm run db:validate
npm run db:generate
npm run db:migrate -- --name descriptive_change
npm run db:deploy
npm run db:status
npm run db:seed
```

Use migrate dev when authoring a new schema change; commit its SQL. Use migrate deploy for applying committed migrations, including staging/production. Review the SQL under `prisma/migrations/` and inspect `_prisma_migrations` with your database client. Never edit an already-applied migration; use a new migration for later changes.

For Docker-hosted commands:

```sh
docker compose -f compose.yaml exec api npm run db:status
docker compose -f compose.yaml exec api npm run db:validate
docker compose -f compose.yaml exec api npm run db:seed
docker compose -f compose.yaml logs -f api postgres
docker compose -f compose.yaml ps
docker compose -f compose.yaml down
```

`down` retains the database volume. For an intentional **development-only destructive reset**, first confirm DATABASE_URL points to the disposable development database and back up any needed data. Then run `npm run db:reset` (or `docker compose -f compose.yaml exec api npm run db:reset`) and approve Prisma's interactive confirmation. This deletes that schema's data, reapplies migrations, and reruns the configured seed. Do not run this on production or shared data. No reset was performed during Task 2.

## Automated verification

```sh
npm run build
npm run lint
npm test
npm run format:check
npm run db:validate
```

`npm test` runs the Task 1-3 regressions plus Task 4 authorization tests. `npm run test:unit` needs no running database; `npm run test:integration` runs database-backed tenant, authentication, and RBAC tests. Generate Prisma Client before testing a fresh checkout.

The integration runner uses TEST_DATABASE_URL if set, otherwise DATABASE_URL, creates a uniquely named `rk_test_<uuid>` schema, applies the actual migration, runs the tests, and drops only that generated schema in a finally block. It never resets public or touches existing tenant data. The development database role needs schema create/drop privileges. If the process is forcibly killed, an abandoned rk_test_ schema may require manual cleanup after confirming it is not used by another test run.

Only the identity-provider boundary is replaced in the integration test module; PostgreSQL queries, NestJS guards, services, validation, migrations, and constraints are real. Tests cover tenant A/B read/write isolation, concurrent contexts, spoofed identity rejection, DTO failures, role/membership FKs, uniqueness, seed mappings/idempotency, safe deletes, and transactional rollback. Expected 500 logs from deliberate failure tests do not indicate a failing suite.

If your existing `.env` uses the container hostname, run all checks within Docker without editing its secrets:

```sh
docker compose -f compose.yaml exec api npm test
docker compose -f compose.yaml exec api npm run build
docker compose -f compose.yaml exec api npm run lint
docker compose -f compose.yaml exec api npm run format:check
```

Dependency overrides retain patched Multer and DeepmergeTS versions while upstream dependency ranges catch up. The worker remains an inactive future extension point. A later phase can add durable audit-log storage and controlled invitation delivery before CRM business modules.

## Docker API health troubleshooting

The API container uses `scripts/api-healthcheck.mjs`, a dependency-free Node probe that calls `127.0.0.1:3000/api/v1/health`. Using the explicit IPv4 loopback avoids `localhost` resolving to IPv6 while NestJS is bound to `0.0.0.0` inside Docker Desktop.

If NestJS starts successfully and `http://localhost:3000/api/v1/health` returns `{"status":"ok"}` but Docker still reports the API as unhealthy with an `OCI runtime exec failed` healthcheck message, treat that as a Docker Desktop/runtime state problem rather than changing RBAC or authentication code. Recreate only the API container first:

```powershell
cd E:\crm
docker compose -f compose.yaml stop api
docker compose -f compose.yaml rm -f api
docker compose -f compose.yaml up -d --build api
docker compose -f compose.yaml ps
```

If the runtime error persists, restart Docker Desktop (or run `wsl --shutdown`, then reopen Docker Desktop) and retry. Do **not** use `docker compose down -v` for this problem because `-v` deletes the CRM and Keycloak database volumes.
