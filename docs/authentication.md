# Authentication and verified tenant context

Task 3 uses self-hosted Keycloak for identity only. CRM users, organizations, memberships, roles and permissions remain in PostgreSQL. No CRM roles are copied into Keycloak. No business modules or additional integration infrastructure are introduced.

## Local architecture

| Service     | Role                                        | Local address                     |
| ----------- | ------------------------------------------- | --------------------------------- |
| web         | React public OIDC client                    | http://localhost:5173             |
| api         | NestJS resource server                      | http://localhost:3000             |
| postgres    | CRM database                                | localhost:5433                    |
| keycloak    | Official `quay.io/keycloak/keycloak:26.7.4` | http://localhost:8080             |
| keycloak-db | Dedicated identity database and volume      | Docker network only; no host port |

Keycloak uses `/health/ready` on its private management port 9000. The health check requires HTTP 200, not merely an open TCP socket. Keycloak waits for its database; API waits for both Keycloak readiness and CRM PostgreSQL. The CRM database lifecycle remains independent.

Realm: **rk-varaha-crm**. The committed development realm import contains configuration and a service account, but no human credentials. Keycloak resolves the admin-client secret from its environment during first import. Existing realms are not overwritten on restart; changing the file does not silently reconfigure an existing realm.

| Client          | Configuration                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rk-varaha-web   | Public SPA; Authorization Code + required PKCE S256; built-in `basic`, profile and email scopes; localhost:5173 redirect URIs/origin; no secret, implicit flow, or password grant |
| rk-varaha-api   | Resource-server audience; no interactive or password grant                                                                                                                        |
| rk-varaha-admin | Confidential server-only service account; client credentials; realm-management view-users, query-users and manage-users only                                                      |

The SPA audience mapper includes `rk-varaha-api` in access tokens, not ID tokens. The built-in `basic` scope supplies the required stable `sub` claim; do not replace the default client-scope list without retaining it. Keycloak's built-in realm-management permissions are infrastructure administration capabilities, not CRM roles.

## Start locally

```sh
npm ci
npm run auth:init-dev
docker compose -f compose.yaml up --build -d
docker compose -f compose.yaml exec api npm run db:seed
```

The initializer fills missing local Keycloak settings and generates random service/database/console credentials in the ignored `.env`. It preserves already-configured values and never prints secrets. Keep that file private. Do not copy `.env` into images or Git. `.env.example` contains placeholders only. On a new checkout, also configure the existing CRM database settings as described in README.

The browser uses `http://localhost:8080`; Docker API uses `http://keycloak:8080` to fetch JWKS and call administration APIs. **Both still validate the exact issuer `http://localhost:8080/realms/rk-varaha-crm`.** An internal URL is not accepted as an alternative issuer.

Open the web app and use **Sign in**. A Keycloak user alone does not grant CRM access: there must be an eligible CRM user record and active organization membership. No permanent human administrator is seeded automatically.

## Explicit first-administrator bootstrap

1. Open the local Keycloak administration console at http://localhost:8080. Use the generated console username and secret from your private `.env`; do not paste them into source, logs, or this documentation.
2. Select `rk-varaha-crm`. Create or identify the intended human user, with a unique email, first name, last name, and enabled account. Set up their password only in Keycloak or through its setup-email workflow. Verify email ownership before marking it verified. Production should use actual email verification; SMTP is not configured by this local stack.
3. Record that user's exact Keycloak identity UUID. In `.env`, set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_IDENTITY_ID, BOOTSTRAP_ORGANIZATION_SLUG (normally rk-varaha-dev), and BOOTSTRAP_ADMIN_ROLE (ORG_ADMIN by default, or SUPER_ADMIN). These are explicit operator inputs; the script never guesses an identity from a partial name.
4. Ensure the development seed exists. For a host-run command, DATABASE_URL must use localhost:5433 and KEYCLOAK_INTERNAL_URL must use localhost:8080. Run:

```sh
npm run auth:bootstrap-admin
```

Alternatively, after editing `.env`, recreate the API environment and run the command inside Docker:

```sh
docker compose -f compose.yaml up -d api
docker compose -f compose.yaml exec api npm run auth:bootstrap-admin
```

The command retrieves the explicitly identified Keycloak user through the service account, requires exactly one matching verified email and an enabled identity, then transactionally creates/links the CRM User, activates membership, and assigns the chosen existing role. Reruns preserve the same user and unique mappings. Blocked users or memberships, identity collisions, ambiguous email matches, and mismatched IDs are refused. It never creates or stores a password and exposes no bootstrap HTTP endpoint. SUPER_ADMIN assignments remain organization-membership scoped under the Task 2 schema; they do not enable global HTTP provisioning in Task 3.

The generated Keycloak console account is a local bootstrap administrator. Production needs a durable, tightly controlled identity-administration process and removal of temporary bootstrap access.

## Backend request flow

1. Read standard `Authorization: Bearer <access-token>`; reject missing/malformed input with 401.
2. `jose` cryptographically verifies RS256 against remote JWKS, exact issuer, API audience, required subject/expiration/issued-at claims, expiration and optional not-before. Payload type must be Bearer, preventing ID-token use. JWKS retrieval is bounded and cached; unknown signing keys trigger refresh after a short cooldown. Keys are not hardcoded in runtime code.
3. Resolve `sub` through User.identityProviderId. Existing ACTIVE links are authoritative; token email changes do not silently change CRM identity or profile.
4. For a previously unlinked user, require a verified, syntactically valid token email matching exactly one normalized CRM email. Only INVITED/ACTIVE users can link. Successful first login changes INVITED to ACTIVE. Unknown emails never create users or memberships.
5. Serializable transactions with bounded conflict retries and a conditional update make first-login linking race-safe. A migration also makes non-null identityProviderId immutable at database level. Identity-link replacement requires a future explicit audited recovery workflow; it is not a normal update.
6. For tenant routes, require a UUID X-Organization-Id header. It must match the route organization UUID. Load active membership and active organization from PostgreSQL, retain the existing Task 2 permission checks, and only then initialize the asynchronous request context with userId, organizationId and identityProviderId. Repositories continue using this context.

401 means missing/invalid authentication. 403 means a valid identity lacks eligible CRM access, membership, organization status, or retained route permission. Missing/malformed tenant headers return 400; route/header mismatch returns 403. Errors do not identify conflicting accounts or disclose tokens. SUSPENDED/DISABLED users cannot access CRM. INVITED users activate only through a verified identity link; invited memberships do not become active automatically.

`GET /api/v1/me` returns the internal profile and only ACTIVE memberships in ACTIVE organizations. It does not expose identityProviderId, tokens, secrets, role claims, or unrelated organizations. No redundant /me/organizations endpoint is needed.

Keycloak realm/client roles and arbitrary claims never set a global CRM administrator flag. Platform administration is derived only from an active PostgreSQL SUPER_ADMIN assignment created through the trusted bootstrap path. Existing self-profile and tenant protections remain in force.

## Browser state and organization selection

The maintained keycloak-js adapter initializes before React Router consumes the callback. The application provides login/logout, loading/error states, protected routes, and refresh before authenticated requests, plus refresh on token expiration. Access and refresh tokens remain in adapter memory; application code never writes them to localStorage or sessionStorage.

After authentication, `/me` determines eligible organizations. One organization is selected automatically; multiple organizations require selection; no organizations yields an explicit administrator-contact state. Requests include the selected X-Organization-Id, but the server independently checks membership every time. Tenant query keys include user and organization IDs. Switching organizations cancels in-flight tenant requests and clears old tenant query data. Logout or refresh failure clears user/tenant state and tokens. The browser does not contain administration credentials.

The workspace status request retains organizations.read enforcement; users lacking that permission see an access-denied state even if `/me` lists an active membership. Task 4 role-management and effective-permission flows are documented in `docs/authorization.md`. Selecting an organization never creates an authorization grant.

## Server administration abstraction

KeycloakAdminService obtains short-lived service tokens using server environment credentials and provides lookup, user creation, disable, and account-setup email operations. It is not exposed through unrestricted controllers. It uses bounded network timeouts and sanitized failures; no credentials or authorization headers are logged. Setup-email operations require configured Keycloak SMTP. The service account is deliberately unable to manage realms, clients, or impersonate users.

## Configuration

| Variable                                                          | Purpose                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| KEYCLOAK_PUBLIC_URL                                               | Browser-facing base URL                                                 |
| KEYCLOAK_INTERNAL_URL                                             | Server-side administration base URL; Compose overrides to keycloak:8080 |
| KEYCLOAK_REALM                                                    | rk-varaha-crm for the committed development import                      |
| KEYCLOAK_ISSUER                                                   | Exact public realm issuer                                               |
| KEYCLOAK_JWKS_URL                                                 | Server-reachable signing-key endpoint; Compose uses internal DNS        |
| KEYCLOAK_API_AUDIENCE                                             | rk-varaha-api                                                           |
| KEYCLOAK_ADMIN_CLIENT_ID / KEYCLOAK_ADMIN_CLIENT_SECRET           | Confidential server service identity                                    |
| KEYCLOAK_DB_USER / KEYCLOAK_DB_PASSWORD / KEYCLOAK_DB_NAME        | Separate identity database configuration                                |
| KC_BOOTSTRAP_ADMIN_USERNAME / KC_BOOTSTRAP_ADMIN_PASSWORD         | Initial Keycloak console administrator                                  |
| VITE_KEYCLOAK_URL / VITE_KEYCLOAK_REALM / VITE_KEYCLOAK_CLIENT_ID | Public browser settings only                                            |
| BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_IDENTITY_ID               | Explicit verified human identity for CLI bootstrap                      |
| BOOTSTRAP_ORGANIZATION_SLUG / BOOTSTRAP_ADMIN_ROLE                | Target tenant and initial role                                          |

API startup validates required identity URLs, realm, audience, and non-placeholder server secret. Issuer must match the configured public realm. Production mode requires HTTPS for identity URLs. Runtime code has no localhost fallback for identity verification.

## Tests and live verification

```sh
npm run build
npm run lint
npm test
npm run format:check
npm run db:validate
node node_modules/playwright/cli.js install chromium
npm run test:auth:live
```

Host unit/integration commands use the host-reachable database URL; the full automated suite can also run inside the API container. Cryptographic tests use **public test-only signing fixtures** and a local JWKS server, not a live identity dependency. These keys are deliberately untrusted outside tests. Tests cover signature/issuer/audience/time checks, rotation, real PostgreSQL linking, first-login races, disabled/suspended accounts, header validation, tenant isolation, bootstrap idempotency, frontend routes, selector behavior, header injection, refresh failure and logout cleanup.

The live test requires the full Docker stack and a local browser installation. It is restricted to local development, creates a temporary synthetic identity with a random password held only in memory, runs real browser Code + PKCE login, verifies `/me`, tenant denial, automatic and multiple organization selection, bootstrap idempotency and logout, then deletes its identity and CRM fixtures. It does not use password grant. No traces, token dumps, screenshots, or credential files are created. Do not kill the test during cleanup; if interrupted, inspect only its smoke-prefixed temporary records before removing them.

## Troubleshooting and production differences

- **401:** confirm exact public issuer, `rk-varaha-api` audience, Bearer access-token type, JWKS reachability, clock, and login freshness. Do not relax validation to accept an internal issuer.
- **403 after login:** confirm the CRM user exists, email is verified for first linking, account status, active membership/organization and the retained route permission. Keycloak registration alone is insufficient.
- **Header/path mismatch:** both UUIDs must name the same selected organization.
- **Admin client authentication fails after changing secrets:** realm import is first-start only. Rotate the stored client secret through a controlled administration process and synchronize server configuration. Do not delete the identity database to bypass configuration on shared systems.
- **Host cannot resolve postgres/keycloak:** container DNS names are internal; host commands use localhost and the published ports. Existing CRM DATABASE_URL is preserved by the initializer.
- **Setup email unavailable:** configure SMTP in Keycloak; local realm import contains no real mail credentials.
- **Existing browser session after reload:** adapter check-sso reestablishes authentication using the Keycloak session, not a persisted access token.

Local `start-dev` and HTTP are development-only. Production should use an explicit TLS origin such as `https://auth.crm.rkvaraha.com`, Keycloak production startup, exact production redirects/origins, trusted proxy configuration, managed secret rotation, protected administration, SMTP, backups and monitoring. Do not expose the identity database or health-management port publicly. Use a single trusted issuer per deployment; replacing it requires a controlled identity migration.

Self-contained JWT validation does not provide immediate remote logout/revocation of already-issued access tokens. Tokens expire after five minutes in the local realm; local CRM user/membership status is checked on every request. Immediate Keycloak revocation or back-channel logout enforcement is a future explicit security decision. Browser tokens in memory reduce persistence risk but do not eliminate XSS risk.

References: [Keycloak 26.7.4 release](https://www.keycloak.org/2026/09/keycloak-2674-released), [JavaScript adapter](https://www.keycloak.org/securing-apps/javascript-adapter), [container configuration](https://www.keycloak.org/server/containers), [realm import](https://www.keycloak.org/server/importExport).
