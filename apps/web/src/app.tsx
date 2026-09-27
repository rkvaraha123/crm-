import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getHealth } from './api';
import { createApiClient, CurrentUser, selectOrganization } from './api-client';
import { useAuth } from './auth/auth-context';
import { AuthorizationProvider } from './authorization/authorization-context';
import { WorkspaceShell } from './workspace/workspace-shell';
import { AdminPortal } from './admin/admin-portal';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.ready)
    return (
      <main className="crm-auth-screen" role="status">
        Preparing sign-in…
      </main>
    );
  return auth.authenticated ? children : <Navigate to="/" replace />;
}

function Home() {
  const auth = useAuth();
  const health = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    retry: 1,
  });

  return (
    <main className="crm-login-page">
      <section className="crm-login-card">
        <div className="crm-login-brand">
          <span className="crm-brand-mark crm-brand-mark-large">RV</span>
          <div>
            <p className="crm-page-kicker">RK VARAHA</p>
            <strong>CRM Workspace</strong>
          </div>
        </div>
        <h1>Customer relationships, organized.</h1>
        <p className="crm-login-copy">
          Manage companies, contacts, teams, activity, and access from one
          secure workspace.
        </p>
        <div className="crm-connection-status">
          <span
            className={
              health.isError ? 'crm-status-dot is-error' : 'crm-status-dot'
            }
            aria-hidden="true"
          />
          {health.isPending
            ? 'Checking CRM API…'
            : health.isError
              ? 'CRM API unavailable'
              : 'CRM API connected'}
        </div>
        {auth.error && (
          <p className="crm-alert" role="alert">
            {auth.error}
          </p>
        )}
        {auth.authenticated ? (
          <Link className="button crm-login-button" to="/app/dashboard">
            Open workspace
          </Link>
        ) : (
          <button
            className="crm-login-button"
            disabled={!auth.ready}
            onClick={() => void auth.session.login()}
          >
            Sign in
          </button>
        )}
      </section>
    </main>
  );
}

export function Workspace() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const api = useMemo(
    () => createApiClient(session.accessToken, session.clear),
    [session],
  );

  const me = useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => api<CurrentUser>('/me', undefined, signal),
    retry: false,
  });

  const [selected, setSelected] = useState<string | null>(null);
  const organizationId = selectOrganization(
    me.data?.organizations ?? [],
    selected,
  );

  useEffect(() => {
    if (selected && organizationId !== selected) setSelected(null);
  }, [selected, organizationId]);

  const organization = useQuery({
    queryKey: ['tenant', me.data?.id, organizationId, 'organization'],
    queryFn: ({ signal }) =>
      api<{ id: string; name: string; slug: string }>(
        `/organizations/${organizationId}`,
        organizationId!,
        signal,
      ),
    enabled: !!organizationId,
    retry: false,
  });

  const permissions = useQuery({
    queryKey: ['tenant', me.data?.id, organizationId, 'permissions'],
    queryFn: ({ signal }) =>
      api<{ permissions: string[] }>(
        `/organizations/${organizationId}/me/permissions`,
        organizationId!,
        signal,
      ),
    enabled: !!organizationId,
    retry: false,
  });

  async function changeOrganization(id: string) {
    await queryClient.cancelQueries({ queryKey: ['tenant'] });
    queryClient.removeQueries({ queryKey: ['tenant'] });
    setSelected(id || null);
  }

  async function logout() {
    await queryClient.cancelQueries();
    queryClient.clear();
    setSelected(null);
    await session.logout();
  }

  if (me.isPending)
    return (
      <main className="crm-auth-screen" role="status">
        Loading your CRM account…
      </main>
    );

  if (me.isError)
    return (
      <main className="crm-auth-screen">
        <section className="crm-error-card" role="alert">
          <p className="crm-page-kicker">RK VARAHA / CRM</p>
          <h1>Access unavailable</h1>
          <p>{me.error.message}</p>
          <div className="mt-6 flex gap-3">
            <button onClick={() => void me.refetch()}>Try again</button>
            <button
              className="crm-secondary-button"
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
        </section>
      </main>
    );

  if (me.data.organizations.length === 0)
    return (
      <main className="crm-auth-screen">
        <section className="crm-error-card" role="status">
          <p className="crm-page-kicker">RK VARAHA / CRM</p>
          <h1>No active organization</h1>
          <p>
            Your identity is valid, but no active CRM organization is assigned
            to this account.
          </p>
          <button className="mt-6" onClick={() => void logout()}>
            Sign out
          </button>
        </section>
      </main>
    );

  if (!organizationId)
    return (
      <main className="crm-auth-screen">
        <section className="crm-error-card">
          <p className="crm-page-kicker">RK VARAHA / CRM</p>
          <h1>Select an organization</h1>
          <p>Choose the CRM workspace you want to open.</p>
          <select
            aria-label="Organization"
            className="crm-large-select"
            value=""
            onChange={(event) => void changeOrganization(event.target.value)}
          >
            <option value="">Choose organization</option>
            {me.data.organizations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </section>
      </main>
    );

  if (organization.isPending || permissions.isPending)
    return (
      <main className="crm-auth-screen" role="status">
        Preparing your organization workspace…
      </main>
    );

  if (organization.isError || permissions.isError)
    return (
      <main className="crm-auth-screen">
        <section className="crm-error-card" role="alert">
          <p className="crm-page-kicker">RK VARAHA / CRM</p>
          <h1>Workspace unavailable</h1>
          <p>
            Your account is signed in, but organization permissions could not be
            loaded.
          </p>
          <button className="mt-6" onClick={() => void logout()}>
            Sign out
          </button>
        </section>
      </main>
    );

  return (
    <AuthorizationProvider permissions={permissions.data.permissions}>
      <WorkspaceShell
        api={api}
        user={me.data}
        organizationId={organizationId}
        organizationName={organization.data.name}
        organizations={me.data.organizations}
        onOrganizationChange={changeOrganization}
        onLogout={logout}
      />
    </AuthorizationProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/admin/*" element={<AdminPortal />} />
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <Workspace />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
