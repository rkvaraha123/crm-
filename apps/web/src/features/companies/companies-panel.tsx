import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';
import { ActivityPanel } from '../activities/activity-panel';
import { CustomFieldInputs, useCustomFields } from '../../custom-fields/custom-field-inputs';

interface Company {
  id: string;
  name: string;
  domain?: string | null;
  website?: string | null;
  industry?: string | null;
  lifecycleStatus: 'PROSPECT' | 'CUSTOMER' | 'PARTNER' | 'OTHER';
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function CompaniesPanel({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const { can } = useAuthorization();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [selected, setSelected] = useState<Company | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const fields = useCustomFields(api, organizationId, 'COMPANY');

  const companies = useQuery({
    queryKey: ['tenant', organizationId, 'companies', search],
    queryFn: ({ signal }) =>
      api<Company[]>(
        `/organizations/${organizationId}/companies?limit=100&search=${encodeURIComponent(search)}`,
        organizationId,
        signal,
      ),
    enabled: can('companies.read'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Company>(
        `/organizations/${organizationId}/companies`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            ...(domain.trim() ? { domain: domain.trim().toLowerCase() } : {}),
            customFields,
          }),
        },
      ),
    onSuccess: async () => {
      setName('');
      setDomain('');
      setCustomFields({});
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'companies'],
      });
    },
  });

  const archive = useMutation({
    mutationFn: (companyId: string) =>
      api<Company>(
        `/organizations/${organizationId}/companies/${companyId}`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: (_data, companyId) => {
      if (selected?.id === companyId) setSelected(null);
      return queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'companies'],
      });
    },
  });

  if (!can('companies.read')) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) create.mutate();
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Companies</h2>
          <p className="mt-1 text-sm text-slate-600">
            Business accounts in this organization.
          </p>
        </div>
        <input
          aria-label="Search companies"
          className="rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Search companies"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {can('companies.create') && (
        <form
          className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-3"
          onSubmit={submit}
        >
          <input
            aria-label="Company name"
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Company name"
            maxLength={180}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            aria-label="Company domain"
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="example.com"
            maxLength={255}
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          />
          <CustomFieldInputs
            fields={fields.data ?? []}
            values={customFields}
            onChange={(key, value) =>
              setCustomFields((current) => ({ ...current, [key]: value }))
            }
          />
          <button disabled={create.isPending || !name.trim()} type="submit">
            {create.isPending ? 'Creating…' : 'Add company'}
          </button>
          {create.isError && (
            <p className="sm:col-span-3" role="alert">
              Company could not be created.
            </p>
          )}
        </form>
      )}

      {companies.isPending ? (
        <p className="mt-5" role="status">
          Loading companies…
        </p>
      ) : companies.isError ? (
        <p className="mt-5" role="alert">
          Companies are unavailable.
        </p>
      ) : companies.data.length === 0 ? (
        <p className="mt-5 text-slate-600">No companies found.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4">Company</th>
                <th className="py-3 pr-4">Domain</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3 pr-4">Owner</th>
                <th className="py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.data.map((company) => (
                <tr className="border-b border-slate-100" key={company.id}>
                  <td className="py-3 pr-4 font-medium">{company.name}</td>
                  <td className="py-3 pr-4 text-slate-600">
                    {company.domain || '—'}
                  </td>
                  <td className="py-3 pr-4">{company.lifecycleStatus}</td>
                  <td className="py-3 pr-4">
                    {company.owner.firstName} {company.owner.lastName}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {can('activities.read') && (
                        <button
                          onClick={() => setSelected(company)}
                          type="button"
                        >
                          Timeline
                        </button>
                      )}
                      {can('companies.delete') && (
                        <button
                          disabled={archive.isPending}
                          onClick={() => archive.mutate(company.id)}
                          type="button"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <ActivityPanel
          api={api}
          organizationId={organizationId}
          subjectKind="companies"
          subjectId={selected.id}
          title={selected.name}
        />
      )}
    </section>
  );
}
