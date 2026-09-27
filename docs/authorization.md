# Enterprise authorization

Task 4 keeps identity and authorization separate. Keycloak proves who the user is. PostgreSQL roles, permission mappings, account state, membership state, and organization state determine what that user may do.

## Request flow

Organization routes execute these checks in order:

1. Verify the bearer JWT through Keycloak JWKS and resolve the CRM user.
2. Require an active CRM user.
3. Require a UUID `X-Organization-Id` equal to the route organization UUID.
4. Require an active membership in an active organization.
5. Load all role assignments for that user and organization in one scoped query.
6. Union the applicable role permissions and evaluate the controller requirement.
7. Initialize the verified asynchronous organization context.
8. Execute tenant-scoped service and repository code.

Controllers declare ALL-required permissions by default:

```ts
@Access({ kind: 'tenant', parameter: 'organizationId' })
@RequirePermissions('settings.update', 'users.update')
```

`@RequireAnyPermission(...)` is available when an endpoint intentionally accepts any one of several permissions. Omitting a permission declaration is only appropriate for organization-scoped self-context endpoints such as effective-permission discovery; tenant membership is still mandatory.

## Effective permissions and role scope

Effective permissions are the unique union of every permission mapped to every applicable role assigned to the user in the selected organization. Queries constrain `UserRole.organizationId`, membership, organization, user status, and role scope in PostgreSQL. Role names and claims from the browser or Keycloak never authorize CRM actions.

The seven organization system roles and their mappings remain defined in `default-roles.ts`. The sole global role is `SUPER_ADMIN`. Its assignments still require an active organization membership. It receives the permission catalog through ordinary mappings rather than an unconditional security bypass.

Platform-only organization and user provisioning resolves `SUPER_ADMIN` from PostgreSQL. Authentication and account checks still run. Keycloak realm/client roles cannot produce platform authority.

`ORG_ADMIN` has the full catalog inside its own organization. It cannot operate in another tenant, assign a global role, alter a global role, or bypass membership. `MANAGER` and lower default roles do not have `settings.update`, so they cannot reach role mutation APIs.

## Role administration

The platform permission catalog is read-only through organization APIs. Administrators can list it and use its existing IDs when defining custom roles. Normal APIs cannot create permission keys.

Custom roles:

- always belong to the verified organization;
- cannot use a reserved built-in role name;
- can receive only permissions the acting user already has;
- cannot be edited by an actor who is assigned that role;
- cannot be deleted while assigned;
- use transactions for role/mapping changes.

Built-in roles are immutable through organization APIs. Global roles are excluded from ordinary role listings and assignment validation. Role replacement rejects self-modification, foreign users, foreign/global role IDs, duplicates, and permission escalation. Existing global assignments are preserved when organization-scoped assignments are replaced.

Administrative mutations emit structured preparation events through `AuthorizationAuditService`: `ROLE_ASSIGNED`, `ROLE_REMOVED`, `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`, and `ROLE_PERMISSIONS_CHANGED`. A durable audit-log data model is deferred.

## Endpoints

| Method and path                                                | Required access                      |
| -------------------------------------------------------------- | ------------------------------------ |
| `GET /organizations/:organizationId/me/permissions`            | Active membership                    |
| `GET /organizations/:organizationId/permissions`               | `settings.read`                      |
| `GET /organizations/:organizationId/roles`                     | `settings.read`                      |
| `POST /organizations/:organizationId/roles`                    | `settings.update`                    |
| `PATCH /organizations/:organizationId/roles/:roleId`           | `settings.update`                    |
| `PUT /organizations/:organizationId/roles/:roleId/permissions` | `settings.update`                    |
| `DELETE /organizations/:organizationId/roles/:roleId`          | `settings.update`                    |
| `GET /organizations/:organizationId/users/:userId/roles`       | `settings.read` and `users.read`     |
| `PUT /organizations/:organizationId/users/:userId/roles`       | `settings.update` and `users.update` |

`GET /me` remains available to every valid authenticated CRM user. It does not require `users.read`. Health remains public.

## Frontend behavior

After organization selection, React retrieves effective permissions from the backend. `AuthorizationProvider`, `can(permission)`, and `<Can permission="...">` control navigation and action visibility. Changing organizations clears tenant queries and loads the new permission set. These checks are user-experience aids; direct calls still pass through the API guards.

The minimal settings UI lists roles and mappings, lists organization users, views and replaces assignments, and creates, edits, or deletes custom roles. The API remains authoritative for every operation.

## Denials and limitations

Invalid authentication returns 401. Valid users without required permission receive a generic 403. Foreign members and roles return generic 400/404 responses where appropriate to avoid cross-tenant disclosure. Responses never describe the caller's role gap.

Authorization currently queries PostgreSQL on each request so revocations take effect immediately. No permission cache or Valkey dependency is used. Structured audit events are logged, but durable, searchable audit storage is a future module. PostgreSQL row-level security is not enabled; all tenant data access must continue through verified context and tenant-scoped repositories.
