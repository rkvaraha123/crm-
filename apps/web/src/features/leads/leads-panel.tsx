import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  companyName?: string | null;
  source?: string | null;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'UNQUALIFIED' | 'CONVERTED';
  owner: { firstName: string; lastName: string };
}

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
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');

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
            firstName,
            lastName,
            ...(email.trim() ? { email: email.trim() } : {}),
            ...(companyName.trim() ? { companyName: companyName.trim() } : {}),
          }),
        },
      ),
    onSuccess: async () => {
      setFirstName('');
      setLastName('');
      setEmail('');
      setCompanyName('');
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
        { method: 'PATCH', body: JSON.stringify({ status }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'leads'],
      }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (firstName.trim() && lastName.trim()) create.mutate();
  }

  return (
    <section className="crm-module-card">
      <div className="crm-module-heading">
        <div>
          <p className="crm-page-kicker">Sales</p>
          <h1>Leads</h1>
          <p>Capture, qualify, and progress prospective customers.</p>
        </div>
        <input
          aria-label="Search leads"
          placeholder="Search leads"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {can('leads.create') && (
        <form className="crm-inline-form" onSubmit={submit}>
          <input
            placeholder="First name"
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <input
            placeholder="Last name"
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            placeholder="Company"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />
          <button disabled={create.isPending} type="submit">
            Add lead
          </button>
        </form>
      )}

      {leads.isPending ? (
        <p role="status">Loading leads…</p>
      ) : leads.isError ? (
        <p role="alert">Leads are unavailable.</p>
      ) : (
        <div className="crm-data-table-wrap">
          <table className="crm-data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Company</th>
                <th>Status</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {leads.data.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>
                      {lead.firstName} {lead.lastName}
                    </strong>
                    <small>{lead.email || 'No email'}</small>
                  </td>
                  <td>{lead.companyName || '—'}</td>
                  <td>
                    <select
                      disabled={!can('leads.update')}
                      value={lead.status}
                      onChange={(event) =>
                        updateStatus.mutate({
                          id: lead.id,
                          status: event.target.value as Lead['status'],
                        })
                      }
                    >
                      <option value="NEW">New</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="QUALIFIED">Qualified</option>
                      <option value="UNQUALIFIED">Unqualified</option>
                      <option value="CONVERTED">Converted</option>
                    </select>
                  </td>
                  <td>
                    {lead.owner.firstName} {lead.owner.lastName}
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
