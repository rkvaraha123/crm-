import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { ApiClient, CurrentUser } from '../api-client';
import { useAuthorization } from '../authorization/authorization-context';
import { AuthorizationAdmin } from '../authorization/admin-panel';
import { CompaniesPanel } from '../features/companies/companies-panel';
import { ContactsPanel } from '../features/contacts/contacts-panel';
import { DashboardPage } from './dashboard-page';
import { TeamPage } from './team-page';
import { AppearancePage } from './appearance-page';
import { DEFAULT_APPEARANCE, contrastColor } from './appearance';

interface WorkspaceShellProps {
  api: ApiClient;
  user: CurrentUser;
  organizationId: string;
  organizationName: string;
  onLogout: () => Promise<void>;
  organizations: CurrentUser['organizations'];
  onOrganizationChange: (id: string) => Promise<void>;
}

interface NavItem {
  to: string;
  label: string;
  description: string;
  permission?: string;
}

const primaryNav: NavItem[] = [
  {
    to: '/app/dashboard',
    label: 'Dashboard',
    description: 'Overview',
  },
  {
    to: '/app/companies',
    label: 'Companies',
    description: 'Accounts',
    permission: 'companies.read',
  },
  {
    to: '/app/contacts',
    label: 'Contacts',
    description: 'People',
    permission: 'contacts.read',
  },
  {
    to: '/app/team',
    label: 'Team',
    description: 'Teams & members',
    permission: 'teams.read',
  },
];

export function WorkspaceShell({
  api,
  user,
  organizationId,
  organizationName,
  onLogout,
  organizations,
  onOrganizationChange,
}: WorkspaceShellProps) {
  const { can } = useAuthorization();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visiblePrimary = primaryNav.filter(
    (item) => !item.permission || can(item.permission),
  );
  const canOpenSettings = can('settings.read');
  const canManageAppearance = can('settings.update');

  const appearance = useQuery({
    queryKey: ['tenant', organizationId, 'appearance'],
    queryFn: ({ signal }) =>
      api<{
        organizationId: string;
        workspaceName: string;
        primaryColor: string;
        accentColor: string;
        sidebarColor: string;
        pageBackground: string;
        surfaceColor: string;
      }>(
        `/organizations/${organizationId}/appearance`,
        organizationId,
        signal,
      ),
  });

  const theme = appearance.data ?? {
    ...DEFAULT_APPEARANCE,
    organizationId,
  };

  const themeStyle = {
    '--crm-primary': theme.primaryColor,
    '--crm-primary-text': contrastColor(theme.primaryColor),
    '--crm-accent': theme.accentColor,
    '--crm-sidebar': theme.sidebarColor,
    '--crm-sidebar-text': contrastColor(theme.sidebarColor),
    '--crm-page': theme.pageBackground,
    '--crm-page-text': contrastColor(theme.pageBackground),
    '--crm-surface': theme.surfaceColor,
    '--crm-surface-text': contrastColor(theme.surfaceColor),
  } as CSSProperties;

  return (
    <div className="crm-shell" style={themeStyle}>
      <aside className={mobileOpen ? 'crm-sidebar is-open' : 'crm-sidebar'}>
        <div className="crm-brand">
          <span className="crm-brand-mark">RV</span>
          <div>
            <strong>{theme.workspaceName}</strong>
            <span>Workspace</span>
          </div>
        </div>

        <nav className="crm-nav" aria-label="Workspace navigation">
          <p className="crm-nav-label">Workspace</p>
          {visiblePrimary.map((item) => (
            <NavLink
              className={({ isActive }) =>
                isActive ? 'crm-nav-link is-active' : 'crm-nav-link'
              }
              key={item.to}
              onClick={() => setMobileOpen(false)}
              to={item.to}
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
            </NavLink>
          ))}

          {canOpenSettings && (
            <>
              <p className="crm-nav-label crm-nav-label-spaced">
                Administration
              </p>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'crm-nav-link is-active' : 'crm-nav-link'
                }
                onClick={() => setMobileOpen(false)}
                to="/app/settings"
              >
                <span>Settings</span>
                <small>Access & configuration</small>
              </NavLink>
            </>
          )}
        </nav>

        <div className="crm-sidebar-footer">
          <div className="crm-user-card">
            <div className="crm-avatar">
              {user.firstName.slice(0, 1)}
              {user.lastName.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <span>{user.email}</span>
            </div>
          </div>
          <button
            className="crm-secondary-button w-full"
            onClick={() => void onLogout()}
          >
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="crm-sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}

      <div className="crm-main">
        <header className="crm-topbar">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              className="crm-menu-button"
              onClick={() => setMobileOpen(true)}
              type="button"
            >
              ☰
            </button>
            <div>
              <p className="crm-topbar-kicker">Organization</p>
              {organizations.length > 1 ? (
                <select
                  aria-label="Organization"
                  className="crm-organization-select"
                  value={organizationId}
                  onChange={(event) =>
                    void onOrganizationChange(event.target.value)
                  }
                >
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              ) : (
                <strong className="crm-organization-name">
                  {organizationName}
                </strong>
              )}
            </div>
          </div>
          <div className="crm-topbar-user">
            <span className="crm-status-dot" aria-hidden="true" />
            <span>Connected</span>
          </div>
        </header>

        <main className="crm-content">
          <Routes>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route
              path="dashboard"
              element={
                <DashboardPage
                  api={api}
                  organizationId={organizationId}
                  user={user}
                />
              }
            />
            <Route
              path="companies"
              element={
                can('companies.read') ? (
                  <CompaniesPanel api={api} organizationId={organizationId} />
                ) : (
                  <Navigate to="/app/dashboard" replace />
                )
              }
            />
            <Route
              path="contacts"
              element={
                can('contacts.read') ? (
                  <ContactsPanel api={api} organizationId={organizationId} />
                ) : (
                  <Navigate to="/app/dashboard" replace />
                )
              }
            />
            <Route
              path="team"
              element={
                can('teams.read') ? (
                  <TeamPage api={api} organizationId={organizationId} />
                ) : (
                  <Navigate to="/app/dashboard" replace />
                )
              }
            />
            <Route
              path="settings"
              element={
                canOpenSettings ? (
                  <SettingsHome />
                ) : (
                  <Navigate to="/app/dashboard" replace />
                )
              }
            />
            <Route
              path="settings/appearance"
              element={
                canManageAppearance ? (
                  <AppearancePage api={api} organizationId={organizationId} />
                ) : (
                  <Navigate to="/app/settings" replace />
                )
              }
            />
            <Route
              path="settings/roles"
              element={
                canOpenSettings ? (
                  <AuthorizationAdmin
                    api={api}
                    organizationId={organizationId}
                  />
                ) : (
                  <Navigate to="/app/dashboard" replace />
                )
              }
            />
            <Route
              path="*"
              element={<Navigate to="/app/dashboard" replace />}
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function SettingsHome() {
  const { can } = useAuthorization();

  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Administration</p>
          <h1>Settings</h1>
          <p>Manage access and workspace configuration.</p>
        </div>
      </div>
      <div className="crm-settings-grid">
        {can('settings.update') && (
          <NavLink className="crm-settings-card" to="/app/settings/appearance">
            <span className="crm-settings-icon">AP</span>
            <div>
              <strong>Appearance</strong>
              <p>Change workspace name, brand colors, sidebar, and surfaces.</p>
            </div>
            <span aria-hidden="true">→</span>
          </NavLink>
        )}
        <NavLink className="crm-settings-card" to="/app/settings/roles">
          <span className="crm-settings-icon">RP</span>
          <div>
            <strong>Roles &amp; Permissions</strong>
            <p>Configure role permissions, record scopes, and user roles.</p>
          </div>
          <span aria-hidden="true">→</span>
        </NavLink>
      </div>
    </section>
  );
}
