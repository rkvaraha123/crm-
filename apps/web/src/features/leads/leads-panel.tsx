import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';
import {
  CustomFieldInputs,
  useCustomFields,
} from '../../custom-fields/custom-field-inputs';

interface Lead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
  customFields?: Record<string, unknown> | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const leadStatuses: Lead['status'][] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
];

export function LeadsPanel({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const { can } = useAuthorization();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const fields = useCustomFields(api, organizationId, 'LEAD');
  const leads = useQuery({
    queryKey: ['tenant', organizationId, 'leads', search],
    queryFn: ({ signal }) =>
      api<Lead[]>(
        `/organizations/${organizationId}/leads?limit=100&search=${encodeURIComponent(search)}`,
        organizationId,
        signal,
      ),
    enabled: can('leads.read'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Lead>(
        `/organizations/${organizationId}/leads`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
            ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
            ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
            ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
            ...(source.trim() ? { source: source.trim() } : {}),
            customFields,
          }),
        },
      ),
    onSuccess: async () => {
      setFirstName('');
      setLastName('');
      setCompanyName('');
      setEmail('');
      setSource('');
      setCustomFields({});
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'leads'],
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Lead['status'] }) =>
      api<Lead>(
        `/organizations/${organizationId}/leads/${id}`,
        organizationId,
        undefined,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'leads'],
      }),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api<Lead>(
        `/organizations/${organizationId}/leads/${id}`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'leads'],
      }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      firstName.trim() ||
      lastName.trim() ||
      companyName.trim() ||
      email.trim()
    )
      create.mutate();
  }

  return (
    <section className="crm-module-page">
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Sales</p>
          <h1>Leads</h1>
          <p>Capture prospects, qualify them, and prepare them for the pipeline.</p>
        </div>
        <input
          aria-label="Search leads"
          className="crm-search-input"
          placeholder="Search leads"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {can('leads.create') && (
        <form className="crm-record-form" onSubmit={submit}>
          <label className="crm-field">
            <span>First name</span>
            <input
              maxLength={80}
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Last name</span>
            <input
              maxLength={80}
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Company</span>
            <input
              maxLength={180}
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Email</span>
            <input
              maxLength={254}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Source</span>
            <input
              maxLength={120}
              placeholder="Website, referral, LinkedIn…"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </label>
          <CustomFieldInputs
            fields={fields.data ?? []}
            values={customFields}
            onChange={(key, value) =>
              setCustomFields((current) => ({ ...current, [key]: value }))
            }
          />
          <div className="crm-form-actions crm-field-wide">
            <button
              disabled={
                create.isPending ||
                !(
                  firstName.trim() ||
                  lastName.trim() ||
                  companyName.trim() ||
                  email.trim()
                )
              }
              type="submit"
            >
              {create.isPending ? 'Creating…' : 'Add lead'}
            </button>
            {create.isError && (
              <span className="crm-inline-error" role="alert">
                Lead could not be created.
              </span>
            )}
          </div>
        </form>
      )}

      {leads.isPending ? (
        <p role="status">Loading leads…</p>
      ) : leads.isError ? (
        <p role="alert">Leads are unavailable.</p>
      ) : leads.data.length === 0 ? (
        <div className="crm-empty-state">
          <strong>No leads yet</strong>
          <p>Add a prospect above or enable an inbound integration later.</p>
        </div>
      ) : (
        <div className="crm-table-wrap">
          <table className="crm-data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Company</th>
                <th>Source</th>
                <th>Status</th>
                <th>Owner</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {leads.data.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>
                      {[lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
                        lead.email ||
                        'Unnamed lead'}
                    </strong>
                    <small>{lead.email || lead.phone || 'No contact detail'}</small>
                  </td>
                  <td>{lead.companyName || '—'}</td>
                  <td>{lead.source || '—'}</td>
                  <td>
                    {can('leads.update') ? (
                      <select
                        aria-label="Lead status"
                        value={lead.status}
                        onChange={(event) =>
                          updateStatus.mutate({
                            id: lead.id,
                            status: event.target.value as Lead['status'],
                          })
                        }
                      >
                        {leadStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      lead.status
                    )}
                  </td>
                  <td>
                    {lead.owner.firstName} {lead.owner.lastName}
                  </td>
                  <td>
                    {can('leads.delete') && (
                      <button
                        className="crm-text-button"
                        disabled={archive.isPending}
                        onClick={() => archive.mutate(lead.id)}
                        type="button"
                      >
                        Archive
                      </button>
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
