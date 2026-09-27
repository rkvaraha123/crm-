// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthSession, AuthAdapter } from './session';
import { AuthProvider } from './auth-context';
import { App } from '../app';
import { createApiClient, selectOrganization } from '../api-client';
function adapter(authenticated = true): AuthAdapter {
  return {
    token: authenticated ? 'test-access-token' : undefined,
    authenticated,
    init: vi.fn().mockResolvedValue(authenticated),
    login: vi.fn().mockResolvedValue(undefined),
    createLogoutUrl: vi.fn().mockReturnValue('https://identity.test/logout'),
    clearToken: vi.fn(),
    updateToken: vi.fn().mockResolvedValue(false),
  };
}
const organizations = [
  {
    id: 'a',
    name: 'Organization A',
    slug: 'a',
    membershipStatus: 'ACTIVE' as const,
  },
  {
    id: 'b',
    name: 'Organization B',
    slug: 'b',
    membershipStatus: 'ACTIVE' as const,
  },
];
const me = {
  id: 'user',
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.invalid',
  organizations,
};
function mockApi(orgs = organizations, permissions: string[] = []) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith('/me')
              ? { ...me, organizations: orgs }
              : url.endsWith('/me/permissions')
                ? { permissions }
                : url.endsWith('/me/record-scopes')
                  ? { companies: 'ORGANIZATION', contacts: 'ORGANIZATION' }
                  : url.endsWith('/appearance')
                    ? {
                        organizationId: 'a',
                        workspaceName: 'RK Varaha CRM',
                        primaryColor: '#0f766e',
                        accentColor: '#14b8a6',
                        sidebarColor: '#0f172a',
                        pageBackground: '#f5f7fb',
                        surfaceColor: '#ffffff',
                      }
                    : url.includes('/companies') ||
                      url.includes('/contacts') ||
                      url.includes('/teams') ||
                      url.endsWith('/roles') ||
                      url.endsWith('/permissions') ||
                      url.endsWith('/members')
                    ? []
                    : url.includes('/organizations/')
                      ? {
                          id: url.endsWith('/a') ? 'a' : 'b',
                          name: url.endsWith('/a')
                            ? 'Organization A'
                            : 'Organization B',
                        }
                      : { status: 'ok' },
          ),
          { status: 200 },
        ),
    ),
  );
}
async function setup(authenticated = true) {
  const authAdapter = adapter(authenticated);
  const navigate = vi.fn();
  const session = new AuthSession(authAdapter, navigate);
  await session.init();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider session={session}>
        <MemoryRouter initialEntries={['/app']}>
          <App />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { session, client, authAdapter, navigate };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('authentication and organization UI', () => {
  it('redirects unauthenticated protected routes to sign-in', async () => {
    mockApi();
    await setup(false);
    expect(
      await screen.findByRole('button', { name: 'Sign in' }),
    ).toBeDefined();
    expect(screen.queryByText('Test User')).toBeNull();
  });
  it('renders the authenticated account', async () => {
    mockApi([organizations[0]]);
    await setup();
    expect(await screen.findByText('Test User')).toBeDefined();
    expect(
      await screen.findByRole('link', { name: /Dashboard/ }),
    ).toBeDefined();
  });
  it('automatically selects a single organization', async () => {
    mockApi([organizations[0]]);
    await setup();
    expect(await screen.findByText('Organization A')).toBeDefined();
    expect(screen.queryByLabelText('Organization')).toBeNull();
  });
  it('uses effective permissions for authorization UI', async () => {
    mockApi(
      [organizations[0]],
      ['settings.read', 'settings.update', 'users.read'],
    );
    await setup();
    fireEvent.click(await screen.findByRole('link', { name: /Admin Panel/ }));
    fireEvent.click(
      await screen.findByRole('link', { name: /Roles & Permissions/ }),
    );
    expect(await screen.findByText('Roles & Permissions')).toBeDefined();
    expect(screen.getByLabelText('New role name')).toBeDefined();
  });
  it('hides authorization administration without settings.read', async () => {
    mockApi([organizations[0]], ['teams.read']);
    await setup();
    await screen.findByText('Organization A');
    expect(screen.queryByRole('link', { name: /Admin Panel/ })).toBeNull();
  });
  it('requires selection for multiple organizations and refreshes tenant data', async () => {
    mockApi();
    const { client } = await setup();
    const select = await screen.findByLabelText('Organization');
    expect((select as HTMLSelectElement).value).toBe('');
    fireEvent.change(select, { target: { value: 'a' } });
    await screen.findByRole('link', { name: /Dashboard/ });
    const topbarSelect = screen.getByLabelText('Organization');
    expect((topbarSelect as HTMLSelectElement).value).toBe('a');
    fireEvent.change(topbarSelect, { target: { value: 'b' } });
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Organization') as HTMLSelectElement).value,
      ).toBe('b'),
    );
    expect(
      client.getQueryData(['tenant', 'user', 'a', 'organization']),
    ).toBeUndefined();
  });
  it('shows an explicit no-membership state', async () => {
    mockApi([]);
    await setup();
    expect(await screen.findByText('No active organization')).toBeDefined();
  });
  it('shows a CRM forbidden state after successful identity login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    );
    await setup();
    expect(await screen.findByRole('alert')).toBeDefined();
    expect(screen.getByText('Access unavailable')).toBeDefined();
  });
  it('clears cached user/tenant data and tokens on logout', async () => {
    mockApi([organizations[0]]);
    const { authAdapter, client, session, navigate } = await setup();
    await screen.findByText('Organization A');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('https://identity.test/logout'),
    );
    expect(session.snapshot().authenticated).toBe(false);
    expect(authAdapter.clearToken).toHaveBeenCalled();
    expect(client.getQueryData(['me'])).toBeUndefined();
    expect(
      client.getQueryData(['tenant', 'user', 'a', 'organization']),
    ).toBeUndefined();
  });
  it('uses PKCE S256 and initializes the adapter only once', async () => {
    const instance = adapter();
    const session = new AuthSession(instance);
    await Promise.all([session.init(), session.init()]);
    expect(instance.init).toHaveBeenCalledTimes(1);
    expect(instance.init).toHaveBeenCalledWith(
      expect.objectContaining({ pkceMethod: 'S256', flow: 'standard' }),
    );
  });
  it('clears the session when refresh fails', async () => {
    const instance = adapter();
    const session = new AuthSession(instance);
    await session.init();
    vi.mocked(instance.updateToken).mockRejectedValue(new Error('expired'));
    await expect(session.accessToken()).rejects.toThrow('Session expired');
    expect(session.snapshot().authenticated).toBe(false);
  });
  it('refreshes before API calls and injects bearer plus tenant headers', async () => {
    const instance = adapter();
    const session = new AuthSession(instance);
    await session.init();
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await createApiClient(session.accessToken, session.clear)(
      '/organizations/a',
      'a',
    );
    expect(instance.updateToken).toHaveBeenCalledWith(30);
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-access-token',
          'X-Organization-Id': 'a',
        },
      }),
    );
  });
  it('sends authorized JSON mutations through the shared client', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetcher);
    await createApiClient(async () => 'token', vi.fn())(
      '/organizations/a/roles',
      'a',
      undefined,
      { method: 'POST', body: JSON.stringify({ name: 'Custom' }) },
    );
    expect(fetcher).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Custom' }),
        headers: {
          Authorization: 'Bearer token',
          'Content-Type': 'application/json',
          'X-Organization-Id': 'a',
        },
      }),
    );
  });
  it('clears session on API 401 and avoids implicit tenant selection for me', async () => {
    const clear = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 401 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(
      createApiClient(async () => 'token', clear)('/me'),
    ).rejects.toMatchObject({ status: 401 });
    expect(clear).toHaveBeenCalled();
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty(
      'X-Organization-Id',
    );
  });
  it('does not select an organization missing from the verified profile', () => {
    expect(selectOrganization(organizations, 'foreign')).toBeNull();
    expect(selectOrganization([organizations[0]], null)).toBe('a');
  });
  it('shows initialization failures without exposing tokens', async () => {
    const instance = adapter();
    vi.mocked(instance.init).mockRejectedValue(new Error('sensitive'));
    const session = new AuthSession(instance);
    await act(async () => session.init());
    expect(session.snapshot()).toEqual({
      ready: true,
      authenticated: false,
      error: 'Sign-in service unavailable. Please reload to try again.',
    });
  });
});
