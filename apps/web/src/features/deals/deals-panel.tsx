import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';
import {
  CustomFieldInputs,
  useCustomFields,
} from '../../custom-fields/custom-field-inputs';

interface Stage {
  id: string;
  name: string;
  position: number;
  probability: number;
  active: boolean;
}

interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  stages: Stage[];
}

interface Deal {
  id: string;
  name: string;
  amount: string;
  currency: string;
  status: 'OPEN' | 'WON' | 'LOST';
  pipelineId: string;
  stageId: string;
  stage: Stage;
  pipeline: { id: string; name: string };
  company?: { id: string; name: string } | null;
  contact?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  owner: { id: string; firstName: string; lastName: string };
}

interface CompanyOption {
  id: string;
  name: string;
}

interface ContactOption {
  id: string;
  firstName: string;
  lastName: string;
}

export function DealsPanel({
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
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const fields = useCustomFields(api, organizationId, 'DEAL');

  const pipelines = useQuery({
    queryKey: ['tenant', organizationId, 'deal-pipelines'],
    queryFn: ({ signal }) =>
      api<Pipeline[]>(
        `/organizations/${organizationId}/deals/pipelines`,
        organizationId,
        signal,
      ),
    enabled: can('deals.read'),
  });

  useEffect(() => {
    if (!pipelineId && pipelines.data?.length) {
      const selected =
        pipelines.data.find((pipeline) => pipeline.isDefault) ??
        pipelines.data[0];
      setPipelineId(selected.id);
      setStageId(selected.stages[0]?.id ?? '');
    }
  }, [pipelineId, pipelines.data]);

  const selectedPipeline = useMemo(
    () => pipelines.data?.find((pipeline) => pipeline.id === pipelineId),
    [pipelineId, pipelines.data],
  );

  const deals = useQuery({
    queryKey: ['tenant', organizationId, 'deals', search, pipelineId],
    queryFn: ({ signal }) =>
      api<Deal[]>(
        `/organizations/${organizationId}/deals?limit=200&search=${encodeURIComponent(search)}${pipelineId ? `&pipelineId=${pipelineId}` : ''}`,
        organizationId,
        signal,
      ),
    enabled: can('deals.read'),
  });

  const companies = useQuery({
    queryKey: ['tenant', organizationId, 'companies', 'deal-options'],
    queryFn: ({ signal }) =>
      api<CompanyOption[]>(
        `/organizations/${organizationId}/companies?limit=100`,
        organizationId,
        signal,
      ),
    enabled: can('deals.create') && can('companies.read'),
  });

  const contacts = useQuery({
    queryKey: ['tenant', organizationId, 'contacts', 'deal-options'],
    queryFn: ({ signal }) =>
      api<ContactOption[]>(
        `/organizations/${organizationId}/contacts?limit=100`,
        organizationId,
        signal,
      ),
    enabled: can('deals.create') && can('contacts.read'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Deal>(
        `/organizations/${organizationId}/deals`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            pipelineId,
            stageId,
            amount: amount ? Number(amount) : 0,
            currency,
            ...(companyId ? { companyId } : {}),
            ...(contactId ? { contactId } : {}),
            customFields,
          }),
        },
      ),
    onSuccess: async () => {
      setName('');
      setAmount('');
      setCompanyId('');
      setContactId('');
      setCustomFields({});
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'deals'],
      });
    },
  });

  const move = useMutation({
    mutationFn: ({ id, nextStageId }: { id: string; nextStageId: string }) =>
      api<Deal>(
        `/organizations/${organizationId}/deals/${id}/stage`,
        organizationId,
        undefined,
        {
          method: 'PATCH',
          body: JSON.stringify({ stageId: nextStageId }),
        },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'deals'],
      }),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api<Deal>(
        `/organizations/${organizationId}/deals/${id}`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'deals'],
      }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim() && pipelineId && stageId) create.mutate();
  }

  return (
    <section className="crm-module-page">
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Sales</p>
          <h1>Deals</h1>
          <p>Track opportunities through a configurable sales pipeline.</p>
        </div>
        <div className="crm-heading-actions">
          <select
            aria-label="Pipeline"
            value={pipelineId}
            onChange={(event) => {
              const id = event.target.value;
              setPipelineId(id);
              const pipeline = pipelines.data?.find((item) => item.id === id);
              setStageId(pipeline?.stages[0]?.id ?? '');
            }}
          >
            {pipelines.data?.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
          <input
            aria-label="Search deals"
            className="crm-search-input"
            placeholder="Search deals"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {can('deals.create') && (
        <form className="crm-record-form" onSubmit={submit}>
          <label className="crm-field crm-field-wide">
            <span>Deal name</span>
            <input
              maxLength={180}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Stage</span>
            <select
              required
              value={stageId}
              onChange={(event) => setStageId(event.target.value)}
            >
              <option value="">Choose stage</option>
              {selectedPipeline?.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-field">
            <span>Amount</span>
            <input
              min="0"
              step="0.01"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Currency</span>
            <input
              maxLength={3}
              minLength={3}
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          </label>
          <label className="crm-field">
            <span>Company</span>
            <select
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
          </label>
          <label className="crm-field">
            <span>Contact</span>
            <select
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
            >
              <option value="">No contact</option>
              {contacts.data?.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.firstName} {contact.lastName}
                </option>
              ))}
            </select>
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
              disabled={create.isPending || !name.trim() || !stageId}
              type="submit"
            >
              {create.isPending ? 'Creating…' : 'Create deal'}
            </button>
            {create.isError && (
              <span className="crm-inline-error" role="alert">
                Deal could not be created.
              </span>
            )}
          </div>
        </form>
      )}

      {deals.isPending || pipelines.isPending ? (
        <p role="status">Loading pipeline…</p>
      ) : deals.isError || pipelines.isError ? (
        <p role="alert">Deal pipeline is unavailable.</p>
      ) : !selectedPipeline ? (
        <div className="crm-empty-state">
          <strong>No active pipeline</strong>
          <p>Create or enable a pipeline from the CRM Admin Panel.</p>
        </div>
      ) : (
        <div className="crm-pipeline-board">
          {selectedPipeline.stages.map((stage) => {
            const stageDeals = deals.data.filter(
              (deal) => deal.stageId === stage.id,
            );
            const value = stageDeals.reduce(
              (sum, deal) => sum + Number(deal.amount),
              0,
            );
            return (
              <section className="crm-pipeline-column" key={stage.id}>
                <header>
                  <div>
                    <strong>{stage.name}</strong>
                    <small>{stageDeals.length} deals</small>
                  </div>
                  <span>{value.toLocaleString()}</span>
                </header>
                <div className="crm-pipeline-cards">
                  {stageDeals.map((deal) => (
                    <article className="crm-deal-card" key={deal.id}>
                      <strong>{deal.name}</strong>
                      <span>
                        {deal.currency} {Number(deal.amount).toLocaleString()}
                      </span>
                      <small>
                        {deal.company?.name ||
                          (deal.contact
                            ? `${deal.contact.firstName} ${deal.contact.lastName}`
                            : 'No association')}
                      </small>
                      {can('deals.update') && (
                        <select
                          aria-label={`Move ${deal.name}`}
                          value={deal.stageId}
                          onChange={(event) =>
                            move.mutate({
                              id: deal.id,
                              nextStageId: event.target.value,
                            })
                          }
                        >
                          {selectedPipeline.stages.map((next) => (
                            <option key={next.id} value={next.id}>
                              {next.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {can('deals.delete') && (
                        <button
                          className="crm-text-button"
                          disabled={archive.isPending}
                          onClick={() => archive.mutate(deal.id)}
                          type="button"
                        >
                          Archive
                        </button>
                      )}
                    </article>
                  ))}
                  {stageDeals.length === 0 && (
                    <p className="crm-pipeline-empty">No deals</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
