import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getHealth } from './api';
import { createApiClient, CurrentUser, selectOrganization } from './api-client';
import { useAuth } from './auth/auth-context';
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  if (!auth.ready) return <p role="status">Preparing sign-in…</p>;
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
    <>
      <p className="eyebrow">RK VARAHA / WORKSPACE</p>
      <h1>Your workspace starts here.</h1>
      <p className="intro">
        Sign in to access your organizations. CRM business features will arrive
        in a later phase.
      </p>
      <p role="status" className="my-6 text-slate-600">
        {health.isPending
          ? 'Checking API…'
          : health.isError
            ? 'API unavailable'
            : 'API connected'}
      </p>
      {auth.error && <p role="alert">{auth.error}</p>}
      {auth.authenticated ? (
        <Link className="button" to="/app">
          Open workspace
        </Link>
      ) : (
        <button
          disabled={!auth.ready}
          onClick={() => void auth.session.login()}
        >
          Sign in
        </button>
      )}
    </>
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
    queryKey: ['tenant', me.data?.id, organizationId],
    queryFn: ({ signal }) =>
      api<{ id: string; name: string; slug: string }>(
        `/organizations/${organizationId}`,
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
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="eyebrow">RK VARAHA / WORKSPACE</p>
        <button onClick={() => void logout()}>Sign out</button>
      </div>
      {me.isPending ? (
        <p role="status">Loading your account…</p>
      ) : me.isError ? (
        <div role="alert">
          <h1>Access unavailable</h1>
          <p>{me.error.message}</p>
          <button className="mt-6" onClick={() => void me.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <h1>Welcome, {me.data.firstName}.</h1>
          <p className="intro">Choose where you want to work.</p>
          {me.data.organizations.length === 0 ? (
            <p className="mt-8" role="status">
              No active organizations are available. Contact your administrator.
            </p>
          ) : (
            <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-8">
              {me.data.organizations.length > 1 ? (
                <>
                  <label htmlFor="organization" className="block font-semibold">
                    Organization
                  </label>
                  <select
                    id="organization"
                    className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3"
                    value={organizationId ?? ''}
                    onChange={(event) =>
                      void changeOrganization(event.target.value)
                    }
                  >
                    <option value="">Select an organization</option>
                    {me.data.organizations.map((org) => (
                      <option value={org.id} key={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <h2 className="text-xl font-semibold">
                  {me.data.organizations[0].name}
                </h2>
              )}
              {!organizationId ? (
                <p className="mt-6" role="status">
                  Select an organization to continue.
                </p>
              ) : organization.isPending ? (
                <p className="mt-6" role="status">
                  Checking organization access…
                </p>
              ) : organization.isError ? (
                <p className="mt-6" role="alert">
                  {organization.error.message}
                </p>
              ) : (
                <div className="mt-6" role="status">
                  <p className="font-semibold text-teal-800">
                    Connected to {organization.data.name}
                  </p>
                  <p className="mt-2 text-slate-600">
                    Your organization workspace is ready.
                  </p>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
export function App() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Workspace />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
