import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { ApiClient, CurrentUser } from '../api-client';
import { useAuthorization } from '../authorization/authorization-context';
import { AuthorizationAdmin } from '../authorization/admin-panel';
import { CompaniesPanel } from '../features/companies/companies-panel';
import { ContactsPanel } from '../features/contacts/contacts-panel';
import { LeadsPanel } from '../features/leads/leads-panel';
import { DealsPanel } from '../features/deals/deals-panel';
import { TasksPanel } from '../features/tasks/tasks-panel';
import { ReportsPanel } from '../features/reports/reports-panel';
import { DashboardPage } from './dashboard-page';
import { TeamPage } from './team-page';
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

type CrmModuleKey =
  'COMPANIES' | 'CONTACTS' | 'LEADS' | 'DEALS' | 'TASKS' | 'REPORTS' | 'TEAM';

interface OrganizationModule {
  key: CrmModuleKey;
  enabled: boolean;
  label: string;
  description?: string | null;
  navOrder: number;
}

interface ModuleSpec {
  key: CrmModuleKey;
  to: string;
  description: string;
  permission: string;
}

const moduleSpecs: ModuleSpec[] = [
  {
    key: 'COMPANIES',
    to: '/app/companies',
    description: 'Accounts',
    permission: 'companies.read',
  },
  {
    key: 'CONTACTS',
    to: '/app/contacts',
    description: 'People',
    permission: 'contacts.read',
  },
  {
    key: 'LEADS',
    to: '/app/leads',
    description: 'Prospects',
    permission: 'leads.read',
  },
  {
    key: 'DEALS',
    to: '/app/deals',
    description: 'Pipeline',
    permission: 'deals.read',
  },
  {
    key: 'TASKS',
    to: '/app/tasks',
    description: 'Follow-ups',
    permission: 'tasks.read',
  },
  {
    key: 'REPORTS',
    to: '/app/reports',
    description: 'Analytics',
    permission: 'reports.read',
  },
  {
    key: 'TEAM',
    to: '/app/team',
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
  const canOpenSettings = can('settings.read');

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
      }>(`/organizations/${organizationId}/appearance`, organizationId, signal),
  });

  const modules = useQuery({
    queryKey: ['tenant', organizationId, 'modules'],
    queryFn: ({ signal }) =>
      api<OrganizationModule[]>(
        `/organizations/${organizationId}/config/modules`,
        organizationId,
        signal,
      ),
  });

  const moduleMap = useMemo(
    () => new Map((modules.data ?? []).map((item) => [item.key, item])),
    [modules.data],
  );

  const enabledModules = useMemo(
    () =>
      new Set(
        (modules.data ?? [])
          .filter((item) => item.enabled)
          .map((item) => item.key),
      ),
    [modules.data],
  );

  const moduleEnabled = (key: CrmModuleKey) => enabledModules.has(key);

  const visiblePrimary = useMemo(
    () =>
      moduleSpecs
        .filter(
          (spec) =>
            moduleMap.get(spec.key)?.enabled === true && can(spec.permission),
        )
        .map((spec) => ({
          ...spec,
          label: moduleMap.get(spec.key)?.label ?? spec.key,
          navOrder: moduleMap.get(spec.key)?.navOrder ?? 999,
          description: moduleMap.get(spec.key)?.description || spec.description,
        }))
        .sort(
          (a, b) => a.navOrder - b.navOrder || a.label.localeCompare(b.label),
        ),
    [can, moduleMap],
  );

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
          <NavLink
            className={({ isActive }) =>
              isActive ? 'crm-nav-link is-active' : 'crm-nav-link'
            }
            onClick={() => setMobileOpen(false)}
            to="/app/dashboard"
          >
            <span>Dashboard</span>
            <small>Overview</small>
          </NavLink>

          {modules.isPending && (
            <span className="crm-nav-loading">Loading modules…</span>
          )}

          {visiblePrimary.map((item) => (
            <NavLink
              className={({ isActive }) =>
                isActive ? 'crm-nav-link is-active' : 'crm-nav-link'
              }
              key={item.key}
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
                <small>Roles & access</small>
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
          {modules.isError ? (
            <section className="crm-error-card" role="alert">
              <p className="crm-page-kicker">Configuration</p>
              <h1>Workspace configuration unavailable</h1>
              <p>
                CRM modules are hidden until the server can verify this
                organization&apos;s product configuration.
              </p>
            </section>
          ) : (
            <Routes>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route
                path="dashboard"
                element={
                  <DashboardPage
                    api={api}
                    enabledModules={enabledModules}
                    organizationId={organizationId}
                    user={user}
                  />
                }
              />
              <Route
                path="companies"
                element={
                  moduleEnabled('COMPANIES') && can('companies.read') ? (
                    <CompaniesPanel api={api} organizationId={organizationId} />
                  ) : (
                    <Navigate to="/app/dashboard" replace />
                  )
                }
              />
              <Route
                path="contacts"
                element={
                  moduleEnabled('CONTACTS') && can('contacts.read') ? (
                    <ContactsPanel api={api} organizationId={organizationId} />
                  ) : (
                    <Navigate to="/app/dashboard" replace />
                  )
                }
              />
              <Route
                path="leads"
                element={
                  moduleEnabled('LEADS') && can('leads.read') ? (
                    <LeadsPanel api={api} organizationId={organizationId} />
                  ) : (
                    <Navigate to="/app/dashboard" replace />
                  )
                }
              />
              <Route
                path="deals"
                element={
                  moduleEnabled('DEALS') && can('deals.read') ? (
                    <DealsPanel api={api} organizationId={organizationId} />
                  ) : (
                    <Navigate to="/app/dashboard" replace />
                  )
                }
              />
              <Route
                path="tasks"
                element={
                  moduleEnabled('TASKS') && can('tasks.read') ? (
                    <TasksPanel api={api} organizationId={organizationId} />
                  ) : (
                    <Navigate to="/app/dashboard" replace />
                  )
                }
              />
              <Route
                path="reports"
                element={
                  moduleEnabled('REPORTS') && can('reports.read') ? (
                    <ReportsPanel api={api} organizationId={organizationId} />
                  ) : (
                    <Navigate to="/app/dashboard" replace />
                  )
                }
              />
              <Route
                path="team"
                element={
                  moduleEnabled('TEAM') && can('teams.read') ? (
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
          )}
        </main>
      </div>
    </div>
  );
}

function SettingsHome() {
  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Administration</p>
          <h1>Settings</h1>
          <p>Manage organization roles, permissions, and workspace access.</p>
        </div>
      </div>
      <div className="crm-settings-grid">
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
