import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import type { ApiClient } from '../api-client';
import { createApiClient } from '../api-client';
import { useAuth } from '../auth/auth-context';
import {
  DEFAULT_APPEARANCE,
  type OrganizationAppearance,
} from '../workspace/appearance';

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  platformAdmin: boolean;
}

interface Overview {
  organizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  users: number;
  activeUsers: number;
  companies: number;
  contacts: number;
  memberships: number;
  database: 'healthy';
}

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  createdAt: string;
  _count: {
    members: number;
    companies: number;
    contacts: number;
  };
  appearance?: {
    workspaceName: string;
    primaryColor: string;
    accentColor: string;
    sidebarColor: string;
    pageBackground: string;
    surfaceColor: string;
  } | null;
}

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'DISABLED';
  createdAt: string;
  memberships: {
    status: string;
    organization: { id: string; name: string };
  }[];
  userRoles: { id: string }[];
}

export function AdminPortal() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(
    () => createApiClient(auth.session.accessToken, auth.session.clear),
    [auth.session],
  );

  if (!auth.ready) {
    return <main className="admin-auth-screen">Preparing admin sign-in…</main>;
  }

  if (!auth.authenticated) {
    return (
      <main className="admin-auth-screen">
        <section className="admin-auth-card">
          <p className="admin-eyebrow">RK VARAHA CRM</p>
          <h1>CRM Admin Panel</h1>
          <p>
            Platform administration for organizations, users, branding, and
            system health.
          </p>
          <button onClick={() => void auth.session.login('/admin')}>
            Sign in as platform admin
          </button>
        </section>
      </main>
    );
  }

  const adminMe = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: ({ signal }) => api<AdminUser>('/admin/me', undefined, signal),
    retry: false,
  });

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await auth.session.logout();
  }

  if (adminMe.isPending)
    return <main className="admin-auth-screen">Verifying platform access…</main>;

  if (adminMe.isError)
    return (
      <main className="admin-auth-screen">
        <section className="admin-auth-card">
          <p className="admin-eyebrow">PLATFORM ACCESS</p>
          <h1>CRM Admin access required</h1>
          <p>
            This account is authenticated, but it does not have the platform
            SUPER_ADMIN role.
          </p>
          <div className="admin-auth-actions">
            <NavLink className="admin-secondary-link" to="/app/dashboard">
              Open CRM workspace
            </NavLink>
            <button onClick={() => void logout()}>Sign out</button>
          </div>
        </section>
      </main>
    );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark">RV</span>
          <div>
            <strong>CRM Admin</strong>
            <small>Control plane</small>
          </div>
        </div>
        <nav className="admin-nav">
          <NavLink to="/admin/dashboard">Dashboard</NavLink>
          <NavLink to="/admin/organizations">Organizations</NavLink>
          <NavLink to="/admin/users">Users</NavLink>
          <NavLink to="/admin/appearance">Appearance</NavLink>
          <NavLink to="/admin/system">System Health</NavLink>
        </nav>
        <div className="admin-sidebar-footer">
          <div>
            <strong>
              {adminMe.data.firstName} {adminMe.data.lastName}
            </strong>
            <small>{adminMe.data.email}</small>
          </div>
          <NavLink className="admin-workspace-link" to="/app/dashboard">
            Open CRM
          </NavLink>
          <button className="admin-signout" onClick={() => void logout()}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">SYSTEM ADMINISTRATION</p>
            <strong>RK Varaha CRM Control Plane</strong>
          </div>
          <span className="admin-platform-badge">SUPER_ADMIN</span>
        </header>
        <div className="admin-content">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard api={api} />} />
            <Route
              path="organizations"
              element={<AdminOrganizations api={api} />}
            />
            <Route path="users" element={<AdminUsers api={api} />} />
            <Route
              path="appearance"
              element={<AdminAppearance api={api} />}
            />
            <Route path="system" element={<AdminSystem api={api} />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function AdminDashboard({ api }: { api: ApiClient }) {
  const overview = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: ({ signal }) => api<Overview>('/admin/overview', undefined, signal),
  });

  if (overview.isPending) return <p role="status">Loading admin dashboard…</p>;
  if (overview.isError) return <p role="alert">Admin dashboard unavailable.</p>;

  const cards = [
    ['Organizations', overview.data.organizations],
    ['Active organizations', overview.data.activeOrganizations],
    ['Users', overview.data.users],
    ['Active users', overview.data.activeUsers],
    ['Companies', overview.data.companies],
    ['Contacts', overview.data.contacts],
    ['Active memberships', overview.data.memberships],
    ['Suspended orgs', overview.data.suspendedOrganizations],
  ];

  return (
    <section>
      <AdminHeading
        kicker="Overview"
        title="CRM Admin Dashboard"
        description="Platform-wide CRM health and customer footprint."
      />
      <div className="admin-metric-grid">
        {cards.map(([label, value]) => (
          <article className="admin-metric-card" key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <div className="admin-panel">
        <h2>Platform status</h2>
        <div className="admin-health-row">
          <span className="admin-health-dot" />
          <div>
            <strong>Database connected</strong>
            <p>PostgreSQL health check passed from the CRM API.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminOrganizations({ api }: { api: ApiClient }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const organizations = useQuery({
    queryKey: ['admin', 'organizations', search],
    queryFn: ({ signal }) =>
      api<OrganizationRow[]>(
        `/admin/organizations?limit=100&search=${encodeURIComponent(search)}`,
        undefined,
        signal,
      ),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: OrganizationRow['status'];
    }) =>
      api<OrganizationRow>(`/admin/organizations/${id}/status`, undefined, undefined, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['admin', 'organizations'] }),
  });

  return (
    <section>
      <AdminHeading
        kicker="Customers"
        title="Organizations"
        description="Manage CRM tenants and their operating status."
      />
      <input
        className="admin-search"
        placeholder="Search organizations"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {organizations.isPending ? (
        <p role="status">Loading organizations…</p>
      ) : organizations.isError ? (
        <p role="alert">Organizations unavailable.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Status</th>
                <th>Members</th>
                <th>Companies</th>
                <th>Contacts</th>
              </tr>
            </thead>
            <tbody>
              {organizations.data.map((organization) => (
                <tr key={organization.id}>
                  <td>
                    <strong>{organization.name}</strong>
                    <small>{organization.slug}</small>
                  </td>
                  <td>
                    <select
                      aria-label={`Status for ${organization.name}`}
                      value={organization.status}
                      onChange={(event) =>
                        updateStatus.mutate({
                          id: organization.id,
                          status: event.target.value as OrganizationRow['status'],
                        })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </td>
                  <td>{organization._count.members}</td>
                  <td>{organization._count.companies}</td>
                  <td>{organization._count.contacts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {updateStatus.isError && (
            <p className="admin-error" role="alert">
              Status change was refused. Platform-admin anchor organizations
              cannot be suspended.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function AdminUsers({ api }: { api: ApiClient }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const users = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: ({ signal }) =>
      api<UserRow[]>(
        `/admin/users?limit=100&search=${encodeURIComponent(search)}`,
        undefined,
        signal,
      ),
  });

  const updateStatus = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: UserRow['status'];
    }) =>
      api<UserRow>(`/admin/users/${id}/status`, undefined, undefined, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  return (
    <section>
      <AdminHeading
        kicker="Identity"
        title="CRM Users"
        description="Review CRM accounts across every organization."
      />
      <input
        className="admin-search"
        placeholder="Search users"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {users.isPending ? (
        <p role="status">Loading users…</p>
      ) : users.isError ? (
        <p role="alert">Users unavailable.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Organizations</th>
                <th>Platform role</th>
              </tr>
            </thead>
            <tbody>
              {users.data.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>
                      {user.firstName} {user.lastName}
                    </strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <select
                      aria-label={`Status for ${user.email}`}
                      disabled={user.userRoles.length > 0}
                      value={user.status}
                      onChange={(event) =>
                        updateStatus.mutate({
                          id: user.id,
                          status: event.target.value as UserRow['status'],
                        })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INVITED">Invited</option>
                      <option value="SUSPENDED">Suspended</option>
                      <option value="DISABLED">Disabled</option>
                    </select>
                  </td>
                  <td>{user.memberships.length}</td>
                  <td>
                    {user.userRoles.length > 0 ? (
                      <span className="admin-platform-badge">SUPER_ADMIN</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AdminAppearance({ api }: { api: ApiClient }) {
  const queryClient = useQueryClient();
  const organizations = useQuery({
    queryKey: ['admin', 'organizations', 'appearance-picker'],
    queryFn: ({ signal }) =>
      api<OrganizationRow[]>('/admin/organizations?limit=200', undefined, signal),
  });
  const [organizationId, setOrganizationId] = useState('');
  const [draft, setDraft] = useState<OrganizationAppearance>({
    ...DEFAULT_APPEARANCE,
    organizationId: '',
  });

  useEffect(() => {
    if (!organizationId && organizations.data?.length)
      setOrganizationId(organizations.data[0].id);
  }, [organizationId, organizations.data]);

  const appearance = useQuery({
    queryKey: ['admin', 'appearance', organizationId],
    queryFn: ({ signal }) =>
      api<OrganizationAppearance>(
        `/admin/organizations/${organizationId}/appearance`,
        undefined,
        signal,
      ),
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (appearance.data) setDraft(appearance.data);
  }, [appearance.data]);

  const save = useMutation({
    mutationFn: () =>
      api<OrganizationAppearance>(
        `/admin/organizations/${organizationId}/appearance`,
        undefined,
        undefined,
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceName: draft.workspaceName,
            primaryColor: draft.primaryColor,
            accentColor: draft.accentColor,
            sidebarColor: draft.sidebarColor,
            pageBackground: draft.pageBackground,
            surfaceColor: draft.surfaceColor,
          }),
        },
      ),
    onSuccess: (saved) => {
      setDraft(saved);
      queryClient.setQueryData(['admin', 'appearance', organizationId], saved);
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'appearance'],
      });
    },
  });

  const reset = useMutation({
    mutationFn: () =>
      api<OrganizationAppearance>(
        `/admin/organizations/${organizationId}/appearance`,
        undefined,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: (saved) => {
      setDraft(saved);
      queryClient.setQueryData(['admin', 'appearance', organizationId], saved);
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const colors = [
    ['primaryColor', 'Primary'],
    ['accentColor', 'Accent'],
    ['sidebarColor', 'Sidebar'],
    ['pageBackground', 'Page'],
    ['surfaceColor', 'Cards'],
  ] as const;

  return (
    <section>
      <AdminHeading
        kicker="Branding"
        title="CRM Appearance"
        description="Change the visual theme for any CRM organization."
      />
      <div className="admin-panel admin-appearance-panel">
        <label>
          Organization
          <select
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          >
            {organizations.data?.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>

        {appearance.isPending ? (
          <p role="status">Loading appearance…</p>
        ) : appearance.isError ? (
          <p role="alert">Appearance unavailable.</p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Workspace name
              <input
                maxLength={80}
                required
                value={draft.workspaceName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    workspaceName: event.target.value,
                  }))
                }
              />
            </label>
            <div className="admin-color-grid">
              {colors.map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    aria-label={label}
                    type="color"
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                  <code>{draft[key]}</code>
                </label>
              ))}
            </div>
            <div className="admin-form-actions">
              <button disabled={save.isPending} type="submit">
                Save theme
              </button>
              <button
                className="admin-secondary-button"
                disabled={reset.isPending}
                onClick={() => reset.mutate()}
                type="button"
              >
                Reset
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function AdminSystem({ api }: { api: ApiClient }) {
  const overview = useQuery({
    queryKey: ['admin', 'system'],
    queryFn: ({ signal }) => api<Overview>('/admin/overview', undefined, signal),
  });

  return (
    <section>
      <AdminHeading
        kicker="Reliability"
        title="System Health"
        description="Live status from the CRM API and PostgreSQL."
      />
      <div className="admin-panel">
        <div className="admin-health-row">
          <span
            className={
              overview.isError ? 'admin-health-dot is-error' : 'admin-health-dot'
            }
          />
          <div>
            <strong>CRM API</strong>
            <p>{overview.isError ? 'Unavailable' : 'Operational'}</p>
          </div>
        </div>
        <div className="admin-health-row">
          <span
            className={
              overview.data?.database === 'healthy'
                ? 'admin-health-dot'
                : 'admin-health-dot is-error'
            }
          />
          <div>
            <strong>PostgreSQL</strong>
            <p>{overview.data?.database ?? 'Checking…'}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminHeading({
  kicker,
  title,
  description,
}: {
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <div className="admin-heading">
      <p className="admin-eyebrow">{kicker}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
