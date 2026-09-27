import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ApiClient, CurrentUser } from '../api-client';
import { useAuthorization } from '../authorization/authorization-context';

interface CompanySummary {
  id: string;
  name: string;
}

interface ContactSummary {
  id: string;
  firstName: string;
  lastName: string;
}

interface TeamSummary {
  id: string;
  name: string;
}

interface RecordScopes {
  companies: 'OWN' | 'TEAM' | 'ORGANIZATION' | null;
  contacts: 'OWN' | 'TEAM' | 'ORGANIZATION' | null;
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
}: {
  api: ApiClient;
  organizationId: string;
  user: CurrentUser;
}) {
  const { can } = useAuthorization();

  const companies = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'companies'],
    queryFn: ({ signal }) =>
      api<CompanySummary[]>(
        `/organizations/${organizationId}/companies?limit=100`,
        organizationId,
        signal,
      ),
    enabled: can('companies.read'),
  });

  const contacts = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'contacts'],
    queryFn: ({ signal }) =>
      api<ContactSummary[]>(
        `/organizations/${organizationId}/contacts?limit=100`,
        organizationId,
        signal,
      ),
    enabled: can('contacts.read'),
  });

  const teams = useQuery({
    queryKey: ['tenant', organizationId, 'dashboard', 'teams'],
    queryFn: ({ signal }) =>
      api<TeamSummary[]>(
        `/organizations/${organizationId}/teams?limit=100`,
        organizationId,
        signal,
      ),
    enabled: can('teams.read'),
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

  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Overview</p>
          <h1>
            {greeting}, {user.firstName}.
          </h1>
          <p>Your current CRM workload and access at a glance.</p>
        </div>
      </div>

      <div className="crm-metric-grid">
        {can('companies.read') && (
          <Link className="crm-metric-card" to="/app/companies">
            <span>Companies</span>
            <strong>
              {companies.isPending ? '…' : displayCount(companies.data?.length)}
            </strong>
            <small>Records visible to you</small>
          </Link>
        )}
        {can('contacts.read') && (
          <Link className="crm-metric-card" to="/app/contacts">
            <span>Contacts</span>
            <strong>
              {contacts.isPending ? '…' : displayCount(contacts.data?.length)}
            </strong>
            <small>Records visible to you</small>
          </Link>
        )}
        {can('teams.read') && (
          <Link className="crm-metric-card" to="/app/team">
            <span>Teams</span>
            <strong>
              {teams.isPending ? '…' : displayCount(teams.data?.length)}
            </strong>
            <small>Active workspace teams</small>
          </Link>
        )}
        <div className="crm-metric-card crm-metric-card-static">
          <span>CRM access</span>
          <strong className="crm-scope-value">
            {scopes.isPending ? '…' : scopeLabel(scopes.data?.companies ?? null)}
          </strong>
          <small>
            Contacts: {scopeLabel(scopes.data?.contacts ?? null)}
          </small>
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
            {can('companies.read') && (
              <Link to="/app/companies">
                <span>
                  <strong>Companies</strong>
                  <small>Search accounts and review activity timelines.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            {can('contacts.read') && (
              <Link to="/app/contacts">
                <span>
                  <strong>Contacts</strong>
                  <small>Manage people, relationships, and notes.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            {can('teams.read') && (
              <Link to="/app/team">
                <span>
                  <strong>Team</strong>
                  <small>Review teams and their active members.</small>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
          </div>
        </section>

        <section className="crm-surface">
          <div className="crm-section-heading">
            <div>
              <p className="crm-page-kicker">Product status</p>
              <h2>Available now</h2>
            </div>
          </div>
          <ul className="crm-status-list">
            <li>
              <span className="crm-status-dot" aria-hidden="true" />
              Companies and activity timelines
            </li>
            <li>
              <span className="crm-status-dot" aria-hidden="true" />
              Contacts and relationship notes
            </li>
            <li>
              <span className="crm-status-dot" aria-hidden="true" />
              Team-based record access
            </li>
            <li>
              <span className="crm-status-dot" aria-hidden="true" />
              Roles, permissions, and record scopes
            </li>
          </ul>
          <p className="crm-muted-note">
            Leads, deals, tasks, and reporting will appear here only after their
            backend modules are implemented.
          </p>
        </section>
      </div>
    </section>
  );
}
