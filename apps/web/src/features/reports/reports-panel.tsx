import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';

interface Summary {
  companies: number;
  contacts: number;
  leads: number;
  deals: number;
  openDealValue: string;
  wonDealValue: string;
  tasks: number;
  overdueTasks: number;
  completedTasks: number;
}

interface FunnelRow {
  status: string;
  count: number;
}

interface PipelineRow {
  pipelineId: string;
  pipelineName: string;
  stageId: string;
  stageName: string;
  currency: string;
  deals: number;
  value: string;
}

export function ReportsPanel({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const summary = useQuery({
    queryKey: ['tenant', organizationId, 'reports', 'summary'],
    queryFn: ({ signal }) =>
      api<Summary>(
        `/organizations/${organizationId}/reports/summary`,
        organizationId,
        signal,
      ),
  });
  const funnel = useQuery({
    queryKey: ['tenant', organizationId, 'reports', 'lead-funnel'],
    queryFn: ({ signal }) =>
      api<FunnelRow[]>(
        `/organizations/${organizationId}/reports/lead-funnel`,
        organizationId,
        signal,
      ),
  });
  const pipeline = useQuery({
    queryKey: ['tenant', organizationId, 'reports', 'pipeline'],
    queryFn: ({ signal }) =>
      api<PipelineRow[]>(
        `/organizations/${organizationId}/reports/pipeline`,
        organizationId,
        signal,
      ),
  });

  if (summary.isPending) return <p role="status">Loading reports…</p>;
  if (summary.isError) return <p role="alert">Reports are unavailable.</p>;

  const metrics = [
    ['Companies', summary.data.companies],
    ['Contacts', summary.data.contacts],
    ['Leads', summary.data.leads],
    ['Deals', summary.data.deals],
    ['Open deal value', summary.data.openDealValue],
    ['Won deal value', summary.data.wonDealValue],
    ['Tasks', summary.data.tasks],
    ['Overdue tasks', summary.data.overdueTasks],
  ];

  return (
    <section className="crm-module-page">
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Analytics</p>
          <h1>Reports</h1>
          <p>Live CRM performance from records you are authorized to see.</p>
        </div>
      </div>

      <div className="crm-metric-grid">
        {metrics.map(([label, value]) => (
          <article className="crm-metric-card crm-metric-card-static" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>

      <div className="crm-dashboard-grid">
        <section className="crm-surface">
          <div className="crm-section-heading">
            <div>
              <p className="crm-page-kicker">Lead funnel</p>
              <h2>Qualification status</h2>
            </div>
          </div>
          {funnel.isPending ? (
            <p>Loading…</p>
          ) : (
            <div className="crm-report-list">
              {funnel.data?.map((row) => (
                <div key={row.status}>
                  <span>{row.status.replace('_', ' ')}</span>
                  <strong>{row.count}</strong>
                </div>
              ))}
              {funnel.data?.length === 0 && <p>No lead data yet.</p>}
            </div>
          )}
        </section>

        <section className="crm-surface">
          <div className="crm-section-heading">
            <div>
              <p className="crm-page-kicker">Pipeline</p>
              <h2>Open opportunity value</h2>
            </div>
          </div>
          {pipeline.isPending ? (
            <p>Loading…</p>
          ) : (
            <div className="crm-report-list">
              {pipeline.data?.map((row) => (
                <div key={`${row.stageId}-${row.currency}`}>
                  <span>
                    {row.pipelineName} / {row.stageName}
                    <small>{row.deals} deals</small>
                  </span>
                  <strong>
                    {row.currency} {Number(row.value).toLocaleString()}
                  </strong>
                </div>
              ))}
              {pipeline.data?.length === 0 && <p>No open deal data yet.</p>}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
