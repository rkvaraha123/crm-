# CRM Core V1

This milestone turns the existing identity/tenant/RBAC platform into the first usable CRM slice.

## Included

### Companies

- tenant-scoped create, list, search, read, update and archive
- lifecycle state: PROSPECT, CUSTOMER, PARTNER, OTHER
- owner recorded from the verified authenticated CRM user
- archived records are excluded from normal reads
- existing `companies.*` RBAC permissions protect every endpoint

### Contacts

- tenant-scoped create, list, search, read, update and archive
- optional same-tenant company association
- lifecycle state: LEAD, PROSPECT, CUSTOMER, OTHER
- normalized email handling
- existing `contacts.*` RBAC permissions protect every endpoint

### Team membership

- add active organization members to teams
- list team members
- remove team members
- database trigger prevents cross-tenant team membership

### Database integrity
PostgreSQL triggers enforce:

- team membership cannot cross organization boundaries
- company owners must be active members of the owning organization
- contact owners must be active members of the owning organization
- contact/company relationships cannot cross organization boundaries

### Frontend
The React workspace now exposes:

- company creation, search, list and archive
- contact creation, search, list and archive
- company selection while creating a contact
- permission-aware actions through the existing authorization context

### Verification
`apps/api/test/crm-core.integration.spec.ts` covers:

- cross-tenant company isolation
- contact/company tenant consistency
- read-only role enforcement
- archive semantics
- team membership tenant enforcement

The GitHub Actions workflow runs install, Prisma generation/validation, formatting, lint, build, unit tests and PostgreSQL-backed integration tests.

## Deliberately deferred

This milestone does **not** claim the CRM is complete. The next domain steps are:

1. record-level OWN / TEAM / ORGANIZATION access scopes
2. activity timeline and notes
3. leads and deterministic lead conversion
4. pipelines and deals
5. tasks/reminders
6. durable audit-event storage
7. Redis/BullMQ worker for asynchronous jobs
8. reporting and integrations

Those should build on this schema rather than being added as disconnected screens.
