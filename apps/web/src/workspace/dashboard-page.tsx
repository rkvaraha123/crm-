import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ApiClient, CurrentUser } from '../api-client';
import { useAuthorization } from '../authorization/authorization-context';

interface RecordSummary {
  id: string;
}

interface TeamSummary {
  id: string;
  name: string;
}

interface RecordScopes {
  companies: 'OWN' | 'TEAM' | 'ORGANIZATION' | null;
  contacts: 'OWN' | 'TEAM' | 'ORGANIZATION' | null;
  leads: 'OWN' | 'TEAM' | 'ORGANIZATION' | null;
  deals: 'OWN' | 'TEAM' | 'ORGANIZATION' | null;
  tasks: 'OWN' | 'TEAM' | 'ORGANIZATION' | null;
}

function displayCount(count: number | undefined) {
  if (count === undefined) return '—';
  return count >= 100 ? '100+' : String(count);
}

function scopeLabel(scope: RecordScopes[keyof RecordScopes]) {
  if (scope === 'OWN') return 'Own records';
  if (scope === 'TEAM') return 'Own + team';
  if (scope === 'ORGANIZATION') return 'Organization';
  return 'Not available';
}

export function DashboardPage({
  api,
  organizationId,
  user,
  enabledModules,
}: {
  api: ApiClient;
  organizationId: string;
  user: CurrentUser;
  enabledModules: Set<string>;
}) {
  const { can } = useAuthorization();
  const enabled = (key: string) => enabledModules.has(key);

  const companies = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'companies'],
    queryFn: ({ signal }) =>
      api<RecordSummary[]>(
        `/organizations/${organizationId}/companies?limit=100`,
        organizationId,
        signal,
      ),
    enabled: enabled('COMPANIES') && can('companies.read'),
  });

  const contacts = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'contacts'],
    queryFn: ({ signal }) =>
      api<RecordSummary[]>(
        `/organizations/${organizationId}/contacts?limit=100`,
        organizationId,
        signal,
      ),
    enabled: enabled('CONTACTS') && can('contacts.read'),
  });

  const leads = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'leads'],
    queryFn: ({ signal }) =>
      api<RecordSummary[]>(
        `/organizations/${organizationId}/leads?limit=100`,
        organizationId,
        signal,
      ),
    enabled: enabled('LEADS') && can('leads.read'),
  });

  const deals = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'deals'],
    queryFn: ({ signal }) =>
      api<RecordSummary[]>(
        `/organizations/${organizationId}/deals?limit=100`,
        organizationId,
        signal,
      ),
    enabled: enabled('DEALS') && can('deals.read'),
  });

  const tasks = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'tasks'],
    queryFn: ({ signal }) =>
      api<RecordSummary[]>(
        `/organizations/${organizationId}/tasks?limit=100`,
        organizationId,
        signal,
      ),
    enabled: enabled('TASKS') && can('tasks.read'),
  });

  const teams = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'teams'],
    queryFn: ({ signal }) =>
      api<TeamSummary[]>(
        `/organizations/${organizationId}/teams?limit=100`,
        organizationId,
        signal,
      ),
    enabled: enabled('TEAM') && can('teams.read'),
  });

  const scopes = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'record-scopes'],
    queryFn: ({ signal }) =>
      api<RecordScopes>(
        `/organizations/${organizationId}/me/record-scopes`,
        organizationId,
        signal,
      ),
  });

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const cards = [
    {
      key: 'COMPANIES',
      permission: 'companies.read',
      to: '/app/companies',
      label: 'Companies',
      count: companies.data?.length,
      pending: companies.isPending,
    },
    {
      key: 'CONTACTS',
      permission: 'contacts.read',
      to: '/app/contacts',
      label: 'Contacts',
      count: contacts.data?.length,
      pending: contacts.isPending,
    },
    {
      key: 'LEADS',
      permission: 'leads.read',
      to: '/app/leads',
      label: 'Leads',
      count: leads.data?.length,
      pending: leads.isPending,
    },
    {
      key: 'DEALS',
      permission: 'deals.read',
      to: '/app/deals',
      label: 'Deals',
      count: deals.data?.length,
      pending: deals.isPending,
    },
    {
      key: 'TASKS',
      permission: 'tasks.read',
      to: '/app/tasks',
      label: 'Tasks',
      count: tasks.data?.length,
      pending: tasks.isPending,
    },
    {
      key: 'TEAM',
      permission: 'teams.read',
      to: '/app/team',
      label: 'Teams',
      count: teams.data?.length,
      pending: teams.isPending,
    },
  ].filter((card) => enabled(card.key) && can(card.permission));

  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Overview</p>
          <h1>
            {greeting}, {user.firstName}.
          </h1>
          <p>Your CRM workload, pipeline, and access at a glance.</p>
        </div>
      </div>

      <div className="crm-metric-grid">
        {cards.map((card) => (
          <Link className="crm-metric-card" key={card.key} to={card.to}>
            <span>{card.label}</span>
            <strong>
              {card.pending ? '…' : displayCount(card.count)}
            </strong>
            <small>Records visible to you</small>
          </Link>
        ))}
        <div className="crm-metric-card crm-metric-card-static">
          <span>CRM access</span>
          <strong className="crm-scope-value">
            {scopes.isPending
              ? '…'
              : scopeLabel(
                  scopes.data?.deals ??
                    scopes.data?.leads ??
                    scopes.data?.companies ??
                    null,
                )}
          </strong>
          <small>Scope is enforced by the API</small>
        </div>
      </div>

      <div className="crm-dashboard-grid">
        <section className="crm-surface">
          <div className="crm-section-heading">
            <div>
              <p className="crm-page-kicker">Quick actions</p>
              <h2>Continue working</h2>
            </div>
          </div>
          <div className="crm-action-list">
            {enabled('LEADS') && can('leads.read') && (
              <Link to="/app/leads">
                <span>
                  <strong>Qualify leads</strong>
                  <small>Review new prospects and update lead status.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            {enabled('DEALS') && can('deals.read') && (
              <Link to="/app/deals">
                <span>
                  <strong>Move deals</strong>
                  <small>Advance opportunities through the sales pipeline.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            {enabled('TASKS') && can('tasks.read') && (
              <Link to="/app/tasks">
                <span>
                  <strong>Complete follow-ups</strong>
                  <small>Review due tasks and team ownership.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            {enabled('REPORTS') && can('reports.read') && (
              <Link to="/app/reports">
                <span>
                  <strong>Review reports</strong>
                  <small>See live lead, pipeline, and workload metrics.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </section>

        <section className="crm-surface">
          <div className="crm-section-heading">
            <div>
              <p className="crm-page-kicker">Configured product</p>
              <h2>Enabled modules</h2>
            </div>
          </div>
          <ul className="crm-status-list">
            {[
              ['COMPANIES', 'Companies'],
              ['CONTACTS', 'Contacts'],
              ['LEADS', 'Leads'],
              ['DEALS', 'Deals & pipelines'],
              ['TASKS', 'Tasks'],
              ['REPORTS', 'Reports'],
              ['TEAM', 'Team management'],
            ]
              .filter(([key]) => enabled(key))
              .map(([key, label]) => (
                <li key={key}>
                  <span className="crm-status-dot" aria-hidden="true" />
                  {label}
                </li>
              ))}
          </ul>
          <p className="crm-muted-note">
            Platform administrators can change this product mix from the CRM
            Admin Panel without changing frontend code.
          </p>
        </section>
      </div>
    </section>
  );
}
