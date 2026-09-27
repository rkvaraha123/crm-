import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';

interface Stage {
  id: string;
  name: string;
  position: number;
  probability: number;
}
interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}
interface Deal {
  id: string;
  name: string;
  amount?: string | number | null;
  currency: string;
  status: 'OPEN' | 'WON' | 'LOST';
  stage: Stage;
  pipeline: { id: string; name: string };
  owner: { firstName: string; lastName: string };
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
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [pipelineId, setPipelineId] = useState('');
  const [stageId, setStageId] = useState('');

  const pipelines = useQuery({
    queryKey: ['tenant', organizationId, 'pipelines'],
    queryFn: ({ signal }) =>
      api<Pipeline[]>(
        `/organizations/${organizationId}/pipelines`,
        organizationId,
        signal,
      ),
    enabled: can('deals.read'),
  });

  useEffect(() => {
    const pipeline = pipelines.data?.[0];
    if (!pipelineId && pipeline) {
      setPipelineId(pipeline.id);
      setStageId(pipeline.stages[0]?.id ?? '');
    }
  }, [pipelineId, pipelines.data]);

  const deals = useQuery({
    queryKey: ['tenant', organizationId, 'deals'],
    queryFn: ({ signal }) =>
      api<Deal[]>(
        `/organizations/${organizationId}/deals`,
        organizationId,
        signal,
      ),
    enabled: can('deals.read'),
  });

  const selectedPipeline = pipelines.data?.find(
    (pipeline) => pipeline.id === pipelineId,
  );

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
            ...(amount.trim() ? { amount: Number(amount) } : {}),
            currency: 'USD',
          }),
        },
      ),
    onSuccess: async () => {
      setName('');
      setAmount('');
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'deals'],
      });
    },
  });

  const move = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      api<Deal>(
        `/organizations/${organizationId}/deals/${id}`,
        organizationId,
        undefined,
        {
          method: 'PATCH',
          body: JSON.stringify({ stageId }),
        },
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
    <section className="crm-module-card">
      <div className="crm-module-heading">
        <div>
          <p className="crm-page-kicker">Sales</p>
          <h1>Deals & Pipeline</h1>
          <p>Track opportunities through your sales pipeline.</p>
        </div>
      </div>

      {can('deals.create') && (
        <form className="crm-inline-form" onSubmit={submit}>
          <input
            placeholder="Deal name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <input
            inputMode="decimal"
            placeholder="Amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <select
            aria-label="Pipeline"
            value={pipelineId}
            onChange={(event) => {
              const next = pipelines.data?.find(
                (pipeline) => pipeline.id === event.target.value,
              );
              setPipelineId(event.target.value);
              setStageId(next?.stages[0]?.id ?? '');
            }}
          >
            {pipelines.data?.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Stage"
            value={stageId}
            onChange={(event) => setStageId(event.target.value)}
          >
            {selectedPipeline?.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <button disabled={create.isPending} type="submit">
            Add deal
          </button>
        </form>
      )}

      {deals.isPending ? (
        <p role="status">Loading deals…</p>
      ) : deals.isError ? (
        <p role="alert">Deals are unavailable.</p>
      ) : (
        <div className="crm-data-table-wrap">
          <table className="crm-data-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Amount</th>
                <th>Stage</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {deals.data.map((deal) => {
                const pipeline = pipelines.data?.find(
                  (item) => item.id === deal.pipeline.id,
                );
                return (
                  <tr key={deal.id}>
                    <td>
                      <strong>{deal.name}</strong>
                      <small>{deal.status}</small>
                    </td>
                    <td>
                      {deal.amount == null
                        ? '—'
                        : `${deal.currency} ${Number(deal.amount).toLocaleString()}`}
                    </td>
                    <td>
                      <select
                        disabled={!can('deals.update')}
                        value={deal.stage.id}
                        onChange={(event) =>
                          move.mutate({
                            id: deal.id,
                            stageId: event.target.value,
                          })
                        }
                      >
                        {pipeline?.stages.map((stage) => (
                          <option key={stage.id} value={stage.id}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {deal.owner.firstName} {deal.owner.lastName}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
