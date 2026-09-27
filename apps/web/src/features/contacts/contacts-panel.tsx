import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';
import { ActivityPanel } from '../activities/activity-panel';

interface CompanyOption {
  id: string;
  name: string;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  lifecycleStatus: 'LEAD' | 'PROSPECT' | 'CUSTOMER' | 'OTHER';
  company?: CompanyOption | null;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function ContactsPanel({
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
  const [companyId, setCompanyId] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);

  const contacts = useQuery({
    queryKey: ['tenant', organizationId, 'contacts', search],
    queryFn: ({ signal }) =>
      api<Contact[]>(
        `/organizations/${organizationId}/contacts?limit=100&search=${encodeURIComponent(search)}`,
        organizationId,
        signal,
      ),
    enabled: can('contacts.read'),
  });

  const companies = useQuery({
    queryKey: ['tenant', organizationId, 'companies', 'contact-options'],
    queryFn: ({ signal }) =>
      api<CompanyOption[]>(
        `/organizations/${organizationId}/companies?limit=100`,
        organizationId,
        signal,
      ),
    enabled: can('contacts.create') && can('companies.read'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Contact>(
        `/organizations/${organizationId}/contacts`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            firstName,
            lastName,
            ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
            ...(companyId ? { companyId } : {}),
          }),
        },
      ),
    onSuccess: async () => {
      setFirstName('');
      setLastName('');
      setEmail('');
      setCompanyId('');
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'contacts'],
      });
    },
  });

  const archive = useMutation({
    mutationFn: (contactId: string) =>
      api<Contact>(
        `/organizations/${organizationId}/contacts/${contactId}`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: (_data, contactId) => {
      if (selected?.id === contactId) setSelected(null);
      return queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'contacts'],
      });
    },
  });

  if (!can('contacts.read')) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (firstName.trim() && lastName.trim()) create.mutate();
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Contacts</h2>
          <p className="mt-1 text-sm text-slate-600">
            People and relationships in this organization.
          </p>
        </div>
        <input
          aria-label="Search contacts"
          className="rounded-lg border border-slate-300 px-3 py-2"
          placeholder="Search contacts"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {can('contacts.create') && (
        <form
          className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={submit}
        >
          <input
            aria-label="First name"
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="First name"
            maxLength={80}
            required
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
          <input
            aria-label="Last name"
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="Last name"
            maxLength={80}
            required
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
          <input
            aria-label="Email"
            className="rounded-lg border border-slate-300 px-3 py-2"
            placeholder="name@example.com"
            type="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <select
            aria-label="Company"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            <option value="">No company</option>
            {companies.data?.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <button
            disabled={create.isPending || !firstName.trim() || !lastName.trim()}
            type="submit"
          >
            {create.isPending ? 'Creating…' : 'Add contact'}
          </button>
          {create.isError && (
            <p className="lg:col-span-5" role="alert">
              Contact could not be created.
            </p>
          )}
        </form>
      )}

      {contacts.isPending ? (
        <p className="mt-5" role="status">
          Loading contacts…
        </p>
      ) : contacts.isError ? (
        <p className="mt-5" role="alert">
          Contacts are unavailable.
        </p>
      ) : contacts.data.length === 0 ? (
        <p className="mt-5 text-slate-600">No contacts found.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4">Contact</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Company</th>
                <th className="py-3 pr-4">Status</th>
                <th className="py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {contacts.data.map((contact) => (
                <tr className="border-b border-slate-100" key={contact.id}>
                  <td className="py-3 pr-4 font-medium">
                    {contact.firstName} {contact.lastName}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">
                    {contact.email || '—'}
                  </td>
                  <td className="py-3 pr-4">{contact.company?.name || '—'}</td>
                  <td className="py-3 pr-4">{contact.lifecycleStatus}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {can('activities.read') && (
                        <button
                          onClick={() => setSelected(contact)}
                          type="button"
                        >
                          Timeline
                        </button>
                      )}
                      {can('contacts.delete') && (
                        <button
                          disabled={archive.isPending}
                          onClick={() => archive.mutate(contact.id)}
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
          subjectKind="contacts"
          subjectId={selected.id}
          title={`${selected.firstName} ${selected.lastName}`}
        />
      )}
    </section>
  );
}
