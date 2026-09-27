# RK Varaha CRM — Enterprise Architecture Baseline

## Purpose

RK Varaha CRM is intended to be a long-lived, multi-tenant CRM product delivered as a service to multiple customer organizations. The architecture must optimize for tenant isolation, correctness, maintainability, predictable deployments, auditability, and operational recovery rather than premature distribution.

The default architecture is a **modular monolith**. Do not split business modules into microservices until measured scaling or organizational constraints justify the operational cost.

## Runtime architecture

```text
Browser
  |
  v
React + Vite + TanStack Query
  |
  | HTTPS / REST / Keycloak access token
  v
NestJS API
  |
  +-- Authentication
  +-- Tenant context
  +-- Authorization / RBAC / record scope
  +-- CRM domain modules
  +-- Audit
  +-- Reporting
  +-- Integration boundaries
  |
  +---- Prisma ----> PostgreSQL
  |
  +---- Redis/BullMQ ----> Worker ----> Email / webhooks / n8n / imports / exports
  |
  +---- Object storage for private attachments
  |
  +---- Structured logs / metrics / tracing
               
Keycloak
  +-- identity, login, MFA, sessions, token issuance
  +-- separate Keycloak PostgreSQL database
```

## Technology baseline

### Web
- React
- TypeScript
- Vite
- TanStack Query for server state
- React Router
- A single reusable design system for forms, tables, drawers, filters, permissions and states
- No authorization decision may rely only on hidden/disabled UI

### API
- NestJS
- TypeScript
- REST under `/api/v1`
- DTO validation with unknown-field rejection
- Central exception normalization
- Request ID / correlation ID on every request
- OpenAPI generated from the API contract
- Controllers validate/delegate; domain logic belongs in services; tenant filtering belongs in scoped repositories

### Identity
- Keycloak owns credentials, MFA, sessions and token issuance
- CRM PostgreSQL owns organizations, membership, business roles and permissions
- Never derive CRM authorization from untrusted client claims
- Never store CRM passwords

### Primary data store
- PostgreSQL
- Prisma for data access and versioned migrations
- Explicit constraints and indexes
- No production `db push`
- No destructive migration without an approved backfill/rollback plan

### Async processing
The worker stays separate from request/response traffic. Use Redis + BullMQ when background work is introduced.

Background-only workloads include:
- email delivery
- webhook retries
- CSV imports/exports
- notifications
- scheduled reminders
- bulk operations
- report generation
- third-party synchronization
- automation execution

n8n may orchestrate external automation, but **must not be the source of truth for CRM transactions**.

## Tenant model

Every tenant-owned business table must carry `organizationId`.

Examples:
- Company
- Contact
- Lead
- Pipeline
- PipelineStage
- Deal
- Task
- Activity
- Note
- Tag
- CustomFieldDefinition
- CustomFieldValue
- Attachment
- WebhookEndpoint

Tenant context must be established server-side after authentication and active-membership validation. Repositories must receive tenant scope from trusted request context, never from arbitrary client body fields.

Queries for tenant data must always include verified tenant scope.

## Authorization model

Authorization requires three layers:

1. **Authentication** — valid identity
2. **Tenant membership** — active membership in the organization
3. **Permission + record scope** — whether the user may perform the action on that record

Recommended record scopes:
- OWN
- TEAM
- ORGANIZATION

Examples:
- `contacts.read.own`
- `contacts.read.team`
- `contacts.read.all`
- `deals.update.own`
- `deals.update.team`
- `deals.update.all`

SUPER_ADMIN remains a platform capability and must not silently bypass authentication, account status, or tenant context.

## Core CRM domain

### Organization and administration
Existing/foundation modules:
- organizations
- users
- memberships
- teams
- roles
- permissions

### Companies
A company/account represents a customer or prospect organization.

Minimum fields:
- id
- organizationId
- ownerId
- name
- domain
- phone
- website
- industry
- lifecycleStatus
- createdAt
- updatedAt
- archivedAt

### Contacts
Contacts are people associated with zero or one primary company and potentially many activities/deals.

Minimum fields:
- id
- organizationId
- ownerId
- companyId
- firstName
- lastName
- email
- phone
- jobTitle
- lifecycleStatus
- createdAt
- updatedAt
- archivedAt

### Leads
Leads represent pre-conversion prospecting state.

Recommended statuses:
- NEW
- CONTACTED
- QUALIFIED
- UNQUALIFIED
- CONVERTED

Lead conversion must be transactional and idempotent. It may create/link a contact, company and deal without producing duplicate records on retry.

### Pipeline and deals
Pipelines and stages are tenant-owned configuration.

Deal minimum fields:
- id
- organizationId
- pipelineId
- stageId
- ownerId
- companyId
- primaryContactId
- name
- amount
- currency
- probability
- expectedCloseDate
- status
- lostReason
- createdAt
- updatedAt

Moving a deal between stages must create a durable activity event.

### Tasks
Tasks support:
- owner/assignee
- due date
- priority
- status
- related entity
- reminders
- completion metadata

### Activities
Activities are the user-facing CRM timeline:
- NOTE_ADDED
- CALL_LOGGED
- EMAIL_SENT
- MEETING_CREATED
- TASK_COMPLETED
- OWNER_CHANGED
- STATUS_CHANGED
- DEAL_STAGE_CHANGED

Do not use activity records as security audit logs.

### Audit log
Security/system audit records are append-only and separate from CRM activities.

Capture:
- organizationId where applicable
- actor user ID
- action
- resource type and ID
- request/correlation ID
- timestamp
- IP/user-agent where policy permits
- before/after metadata with sensitive fields redacted

Application roles should not have update/delete permission on audit rows.

## SaaS/service concerns

Because the CRM will be provided to customers as a service, add these as product capabilities rather than ad-hoc admin features:

- tenant lifecycle: trial/active/suspended/closed
- subscription/plan reference
- usage limits and quotas
- feature flags/entitlements
- customer onboarding
- invitation lifecycle
- tenant-level export
- tenant deletion/retention workflow
- support access with explicit audit trail
- data retention policies
- backup/restore procedures
- status/incident communication
- per-tenant rate limits where necessary

Billing may be integrated later; do not couple core CRM records directly to one payment provider.

## API design rules

- Version APIs under `/api/v1`
- Use cursor pagination for high-growth tables; bounded offset pagination is acceptable for small admin lists
- Stable sorting on all lists
- Explicit filters; never allow arbitrary SQL-like client filtering
- Idempotency keys for externally retried writes and conversion/import operations
- Optimistic concurrency for records where silent overwrite would be harmful
- 400 validation, 401 unauthenticated, 403 denied, 404 inaccessible/not found where enumeration matters, 409 conflict
- Never return internal exception messages or secrets

## Database rules

- UUID primary keys
- `timestamptz` timestamps
- explicit foreign keys
- tenant-leading indexes for tenant-owned tables
- normalized case-insensitive fields where required
- soft archive for customer CRM records unless legal/product requirements mandate deletion
- unique constraints should include `organizationId` when uniqueness is tenant-local
- migrations are immutable once deployed
- production migrations must be backward compatible for rolling deployments where possible

For the highest-value tenant tables, evaluate PostgreSQL RLS as defense in depth after repository-scoped isolation is stable. RLS is not a substitute for correct application authorization.

## Frontend architecture

Suggested feature structure:

```text
apps/web/src/
  app/
  auth/
  components/
  features/
    companies/
    contacts/
    leads/
    deals/
    tasks/
    activities/
    reports/
    settings/
  lib/
```

Reusable primitives:
- DataTable
- Pagination
- FilterBar
- GlobalSearch
- RecordDrawer
- ActivityTimeline
- OwnerPicker
- TeamPicker
- TagPicker
- PermissionBoundary
- EmptyState
- ErrorState
- LoadingSkeleton
- ConfirmDialog

Every mutation must provide clear loading, success and error states. Do not silently fail.

## Observability and operations

Before production:
- structured JSON logs
- request ID propagated API -> worker -> integrations
- health and readiness endpoints
- database connectivity checks
- job queue health
- error tracking
- latency/error-rate metrics
- audit trail
- backup monitoring
- restore drill
- disk/database capacity alerts
- failed-job visibility and retry policy

## Deployment model

Use containers and an explicit environment configuration contract.

Recommended environments:
- local
- test
- staging
- production

Never treat staging and production as the same database or Keycloak realm.

Production deploys should:
1. build immutable images
2. run static/type/test gates
3. validate migrations
4. back up according to policy
5. apply migrations
6. deploy API/worker/web
7. run smoke tests
8. automatically stop/rollback application deployment on health failure

## Module build order

1. Repository/security baseline
2. Auth + tenant + RBAC hardening
3. Companies
4. Contacts
5. Leads + transactional conversion
6. Pipelines + deals
7. Tasks
8. Activities/timeline
9. Search/filtering
10. Reporting
11. Worker + notifications
12. Imports/exports
13. Email/calendar integrations
14. Automation/webhooks
15. SaaS plans/entitlements/support tooling

Do not add AI, microservices, Kafka, Elasticsearch or a separate database per customer until a measured requirement justifies them.

## Architecture decision

**Keep the modular monolith.** It gives RK Varaha CRM a strong boundary model with substantially lower operational risk than premature microservices while preserving a clean path to extract modules later if real scaling data demands it.
