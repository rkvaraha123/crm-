# Security Policy

## Scope

RK Varaha CRM is a multi-tenant customer-facing CRM. Security issues that may expose credentials, cross tenant boundaries, bypass authorization, alter audit history, or leak customer data are treated as critical.

## Secret handling

- Never commit `.env`, private keys, database passwords, API tokens, Keycloak client secrets, SMTP credentials or cloud credentials.
- Browser-visible `VITE_` variables are never secrets.
- Use environment/secret stores per deployment environment.
- If a secret is committed to Git, deleting the file is not sufficient: rotate the secret and clean history when appropriate.
- Development credentials must never be reused in staging or production.

## Authentication

Keycloak owns:
- credentials
- MFA
- session management
- token issuance

The CRM API verifies tokens and resolves them to CRM identities. Client-provided user IDs are not trusted for authorization.

## Tenant isolation

A route/header organization ID is a routing hint, not proof of access.

For tenant-owned operations:
1. verify identity
2. verify active CRM user
3. verify active organization
4. verify active membership
5. verify permission and record scope
6. derive repository tenant filtering from trusted server context

Cross-tenant access must fail closed.

## Authorization

CRM roles and permissions are stored and evaluated by the application/PostgreSQL model. UI visibility is only convenience; every sensitive action must be denied or allowed by the API.

Use explicit resource/action permissions and record scopes (OWN/TEAM/ORGANIZATION) rather than broad client-side role checks.

## Data and API security

- Validate and bound all inputs.
- Reject unknown DTO properties.
- Parameterize database access through Prisma or reviewed SQL.
- Do not expose internal errors.
- Apply rate limits to authentication-adjacent and abuse-prone endpoints.
- Use idempotency for retryable external writes.
- Redact secrets and customer-sensitive fields from logs.
- Sanitize uploaded filenames/content and store attachments privately.
- Use signed, time-bounded download access for private files.
- Validate webhook signatures where providers support them.

## Audit

Security audit records must be append-only to ordinary application users. Record authentication/authorization administration, role changes, exports, support access and other high-impact actions.

CRM activity timeline entries are not a substitute for security audit logs.

## Dependencies

- keep lockfiles committed
- use automated dependency update alerts
- review high/critical advisories
- do not blindly auto-merge dependency changes into production
- rebuild images regularly to pick up base image patches

## Production boundaries

- production database is not publicly exposed
- Keycloak admin endpoints are restricted
- TLS is mandatory
- staging and production use separate secrets/databases/realms
- least-privilege database users are preferred
- backups are encrypted and access-controlled
- restore procedures are tested

## Reporting a vulnerability

Do not publish credentials or customer data in public issues. Use the repository owner's private security reporting channel when enabled.

## Current repository note

A local `.env` file was previously committed to this public repository. Any non-disposable credential that appeared in Git history should be considered exposed and rotated. Removing the file from the latest tree does not revoke previously exposed credentials.
