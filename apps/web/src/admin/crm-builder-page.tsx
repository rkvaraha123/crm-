import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../api-client';

interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
}

type ModuleKey =
  | 'COMPANIES'
  | 'CONTACTS'
  | 'LEADS'
  | 'DEALS'
  | 'TASKS'
  | 'REPORTS'
  | 'TEAM';

interface ModuleRow {
  id?: string | null;
  organizationId: string;
  key: ModuleKey;
  enabled: boolean;
  label: string;
  description?: string | null;
  navOrder: number;
}

type CustomEntity = 'COMPANY' | 'CONTACT' | 'LEAD' | 'DEAL' | 'TASK';
type CustomFieldType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT';

interface CustomField {
  id: string;
  entity: CustomEntity;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  active: boolean;
  options?: unknown;
  displayOrder: number;
}

interface PipelineStage {
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
  active: boolean;
  stages: PipelineStage[];
}

const entities: CustomEntity[] = [
  'COMPANY',
  'CONTACT',
  'LEAD',
  'DEAL',
  'TASK',
];

const fieldTypes: CustomFieldType[] = [
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DATE',
  'BOOLEAN',
  'SELECT',
];

export function CrmBuilderPage({ api }: { api: ApiClient }) {
  const queryClient = useQueryClient();
  const organizations = useQuery({
    queryKey: ['admin', 'organizations', 'builder-picker'],
    queryFn: ({ signal }) =>
      api<OrganizationOption[]>(
        '/admin/organizations?limit=200',
        undefined,
        signal,
      ),
  });
  const [organizationId, setOrganizationId] = useState('');

  useEffect(() => {
    if (!organizationId && organizations.data?.length)
      setOrganizationId(organizations.data[0].id);
  }, [organizationId, organizations.data]);

  const modules = useQuery({
    queryKey: ['admin', 'builder', organizationId, 'modules'],
    queryFn: ({ signal }) =>
      api<ModuleRow[]>(
        `/admin/organizations/${organizationId}/modules`,
        undefined,
        signal,
      ),
    enabled: !!organizationId,
  });

  const saveModule = useMutation({
    mutationFn: ({
      key,
      data,
    }: {
      key: ModuleKey;
      data: Partial<Pick<ModuleRow, 'enabled' | 'label' | 'description' | 'navOrder'>>;
    }) =>
      api<ModuleRow>(
        `/admin/organizations/${organizationId}/modules/${key}`,
        undefined,
        undefined,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['admin', 'builder', organizationId, 'modules'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['tenant', organizationId, 'modules'],
        }),
      ]);
    },
  });

  return (
    <section>
      <div className="admin-heading">
        <p className="admin-eyebrow">NO-CODE PRODUCT CONTROL</p>
        <h1>CRM Builder</h1>
        <p>
          Configure each customer workspace without editing React, NestJS, or
          database code.
        </p>
      </div>

      <div className="admin-builder-picker">
        <label>
          Organization
          <select
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          >
            {organizations.data?.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name} ({organization.slug})
              </option>
            ))}
          </select>
        </label>
      </div>

      {!organizationId ? (
        <div className="admin-panel">
          <p>Select an organization to configure its CRM.</p>
        </div>
      ) : (
        <>
          <section className="admin-panel">
            <div className="admin-section-title">
              <div>
                <p className="admin-eyebrow">MODULES</p>
                <h2>Workspace services</h2>
                <p>
                  Enable, disable, rename, and reorder the CRM navigation.
                </p>
              </div>
            </div>
            {modules.isPending ? (
              <p role="status">Loading modules…</p>
            ) : modules.isError ? (
              <p role="alert">CRM modules are unavailable.</p>
            ) : (
              <div className="admin-builder-list">
                {modules.data.map((module) => (
                  <ModuleEditor
                    key={module.key}
                    module={module}
                    saving={saveModule.isPending}
                    onSave={(data) =>
                      saveModule.mutate({ key: module.key, data })
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <CustomFieldsBuilder
            api={api}
            organizationId={organizationId}
          />

          <PipelineBuilder api={api} organizationId={organizationId} />
        </>
      )}
    </section>
  );
}

function ModuleEditor({
  module,
  saving,
  onSave,
}: {
  module: ModuleRow;
  saving: boolean;
  onSave: (
    data: Partial<
      Pick<ModuleRow, 'enabled' | 'label' | 'description' | 'navOrder'>
    >,
  ) => void;
}) {
  const [enabled, setEnabled] = useState(module.enabled);
  const [label, setLabel] = useState(module.label);
  const [description, setDescription] = useState(module.description ?? '');
  const [navOrder, setNavOrder] = useState(module.navOrder);

  useEffect(() => {
    setEnabled(module.enabled);
    setLabel(module.label);
    setDescription(module.description ?? '');
    setNavOrder(module.navOrder);
  }, [module]);

  return (
    <article className="admin-module-row">
      <div className="admin-module-key">
        <span className={enabled ? 'is-enabled' : 'is-disabled'} />
        <div>
          <strong>{module.key}</strong>
          <small>{enabled ? 'Visible and available' : 'Disabled'}</small>
        </div>
      </div>
      <label>
        Label
        <input
          maxLength={80}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label>
        Order
        <input
          max={1000}
          min={0}
          type="number"
          value={navOrder}
          onChange={(event) => setNavOrder(Number(event.target.value))}
        />
      </label>
      <label className="admin-module-description">
        Description
        <input
          maxLength={255}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      <label className="admin-toggle">
        <input
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          type="checkbox"
        />
        Enabled
      </label>
      <button
        disabled={saving || !label.trim()}
        onClick={() =>
          onSave({
            enabled,
            label: label.trim(),
            description: description.trim() || undefined,
            navOrder,
          })
        }
        type="button"
      >
        Save
      </button>
    </article>
  );
}

function CustomFieldsBuilder({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [entity, setEntity] = useState<CustomEntity>('CONTACT');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [fieldType, setFieldType] = useState<CustomFieldType>('TEXT');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);

  const fields = useQuery({
    queryKey: ['admin', 'builder', organizationId, 'fields', entity],
    queryFn: ({ signal }) =>
      api<CustomField[]>(
        `/admin/organizations/${organizationId}/custom-fields?entity=${entity}`,
        undefined,
        signal,
      ),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['admin', 'builder', organizationId, 'fields'],
      }),
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'custom-fields'],
      }),
    ]);
  };

  const create = useMutation({
    mutationFn: () =>
      api<CustomField>(
        `/admin/organizations/${organizationId}/custom-fields`,
        undefined,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            entity,
            key,
            label,
            fieldType,
            required,
            displayOrder,
            ...(fieldType === 'SELECT'
              ? {
                  options: options
                    .split(',')
                    .map((option) => option.trim())
                    .filter(Boolean),
                }
              : {}),
          }),
        },
      ),
    onSuccess: async () => {
      setKey('');
      setLabel('');
      setRequired(false);
      setOptions('');
      setDisplayOrder(0);
      await refresh();
    },
  });

  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<
        Pick<
          CustomField,
          | 'label'
          | 'fieldType'
          | 'required'
          | 'active'
          | 'displayOrder'
        >
      > & { options?: string[] };
    }) =>
      api<CustomField>(
        `/admin/organizations/${organizationId}/custom-fields/${id}`,
        undefined,
        undefined,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: refresh,
  });

  const disable = useMutation({
    mutationFn: (id: string) =>
      api<CustomField>(
        `/admin/organizations/${organizationId}/custom-fields/${id}`,
        undefined,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: refresh,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (key.trim() && label.trim()) create.mutate();
  }

  return (
    <section className="admin-panel">
      <div className="admin-section-title">
        <div>
          <p className="admin-eyebrow">CUSTOM FIELDS</p>
          <h2>Record properties</h2>
          <p>
            Add customer-specific properties without changing the database
            schema again.
          </p>
        </div>
        <select
          aria-label="Custom field entity"
          value={entity}
          onChange={(event) => setEntity(event.target.value as CustomEntity)}
        >
          {entities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <form className="admin-builder-form" onSubmit={submit}>
        <label>
          Internal key
          <input
            maxLength={80}
            pattern="[a-z][a-z0-9_]*"
            placeholder="customer_tier"
            required
            value={key}
            onChange={(event) =>
              setKey(
                event.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_]/g, '_')
                  .replace(/^[^a-z]+/, ''),
              )
            }
          />
        </label>
        <label>
          Display label
          <input
            maxLength={120}
            required
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </label>
        <label>
          Type
          <select
            value={fieldType}
            onChange={(event) =>
              setFieldType(event.target.value as CustomFieldType)
            }
          >
            {fieldTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label>
          Order
          <input
            max={1000}
            min={0}
            type="number"
            value={displayOrder}
            onChange={(event) => setDisplayOrder(Number(event.target.value))}
          />
        </label>
        {fieldType === 'SELECT' && (
          <label className="admin-builder-wide">
            Select options
            <input
              placeholder="Gold, Silver, Bronze"
              value={options}
              onChange={(event) => setOptions(event.target.value)}
            />
          </label>
        )}
        <label className="admin-toggle">
          <input
            checked={required}
            onChange={(event) => setRequired(event.target.checked)}
            type="checkbox"
          />
          Required
        </label>
        <button
          disabled={
            create.isPending ||
            !key.trim() ||
            !label.trim() ||
            (fieldType === 'SELECT' && !options.trim())
          }
          type="submit"
        >
          Add field
        </button>
      </form>

      {create.isError && (
        <p className="admin-error" role="alert">
          The custom field could not be created. Check the key and options.
        </p>
      )}

      <div className="admin-table-wrap admin-builder-table">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Required</th>
              <th>Order</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fields.data?.map((field) => (
              <CustomFieldEditor
                field={field}
                key={field.id}
                saving={update.isPending || disable.isPending}
                onDisable={() => disable.mutate(field.id)}
                onSave={(data) => update.mutate({ id: field.id, data })}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomFieldEditor({
  field,
  saving,
  onSave,
  onDisable,
}: {
  field: CustomField;
  saving: boolean;
  onSave: (data: {
    label: string;
    required: boolean;
    active: boolean;
    displayOrder: number;
  }) => void;
  onDisable: () => void;
}) {
  const [label, setLabel] = useState(field.label);
  const [required, setRequired] = useState(field.required);
  const [active, setActive] = useState(field.active);
  const [displayOrder, setDisplayOrder] = useState(field.displayOrder);

  useEffect(() => {
    setLabel(field.label);
    setRequired(field.required);
    setActive(field.active);
    setDisplayOrder(field.displayOrder);
  }, [field]);

  return (
    <tr>
      <td>
        <input
          aria-label={`Label for ${field.key}`}
          maxLength={120}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <small>{field.key}</small>
      </td>
      <td>{field.fieldType.replace('_', ' ')}</td>
      <td>
        <input
          aria-label={`Required ${field.key}`}
          checked={required}
          onChange={(event) => setRequired(event.target.checked)}
          type="checkbox"
        />
      </td>
      <td>
        <input
          aria-label={`Order ${field.key}`}
          className="admin-small-number"
          min={0}
          type="number"
          value={displayOrder}
          onChange={(event) => setDisplayOrder(Number(event.target.value))}
        />
      </td>
      <td>
        <label className="admin-toggle admin-toggle-compact">
          <input
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
            type="checkbox"
          />
          {active ? 'Active' : 'Hidden'}
        </label>
      </td>
      <td>
        <div className="admin-row-actions">
          <button
            disabled={saving || !label.trim()}
            onClick={() =>
              onSave({ label: label.trim(), required, active, displayOrder })
            }
            type="button"
          >
            Save
          </button>
          {field.active && (
            <button
              className="admin-secondary-button"
              disabled={saving}
              onClick={onDisable}
              type="button"
            >
              Disable
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function PipelineBuilder({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const pipelines = useQuery({
    queryKey: ['admin', 'builder', organizationId, 'pipelines'],
    queryFn: ({ signal }) =>
      api<Pipeline[]>(
        `/admin/organizations/${organizationId}/pipelines`,
        undefined,
        signal,
      ),
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ['admin', 'builder', organizationId, 'pipelines'],
    });

  const create = useMutation({
    mutationFn: () =>
      api<Pipeline>(
        `/admin/organizations/${organizationId}/pipelines`,
        undefined,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({ name }),
        },
      ),
    onSuccess: async () => {
      setName('');
      await refresh();
    },
  });

  const updatePipeline = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; isDefault?: boolean; active?: boolean };
    }) =>
      api<Pipeline>(
        `/admin/organizations/${organizationId}/pipelines/${id}`,
        undefined,
        undefined,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: refresh,
  });

  const createStage = useMutation({
    mutationFn: ({
      pipelineId,
      data,
    }: {
      pipelineId: string;
      data: { name: string; position: number; probability: number };
    }) =>
      api<PipelineStage>(
        `/admin/organizations/${organizationId}/pipelines/${pipelineId}/stages`,
        undefined,
        undefined,
        { method: 'POST', body: JSON.stringify(data) },
      ),
    onSuccess: refresh,
  });

  const updateStage = useMutation({
    mutationFn: ({
      pipelineId,
      stageId,
      data,
    }: {
      pipelineId: string;
      stageId: string;
      data: {
        name?: string;
        position?: number;
        probability?: number;
        active?: boolean;
      };
    }) =>
      api<PipelineStage>(
        `/admin/organizations/${organizationId}/pipelines/${pipelineId}/stages/${stageId}`,
        undefined,
        undefined,
        { method: 'PATCH', body: JSON.stringify(data) },
      ),
    onSuccess: refresh,
  });

  const disableStage = useMutation({
    mutationFn: ({
      pipelineId,
      stageId,
    }: {
      pipelineId: string;
      stageId: string;
    }) =>
      api<PipelineStage>(
        `/admin/organizations/${organizationId}/pipelines/${pipelineId}/stages/${stageId}`,
        undefined,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: refresh,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) create.mutate();
  }

  return (
    <section className="admin-panel">
      <div className="admin-section-title">
        <div>
          <p className="admin-eyebrow">SALES PIPELINES</p>
          <h2>Deal stages</h2>
          <p>
            Build different sales processes and stage probabilities without
            deployments.
          </p>
        </div>
      </div>

      <form className="admin-inline-form" onSubmit={submit}>
        <input
          maxLength={120}
          placeholder="New pipeline name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button disabled={create.isPending || !name.trim()} type="submit">
          Create pipeline
        </button>
      </form>

      <div className="admin-pipeline-grid">
        {pipelines.data?.map((pipeline) => (
          <PipelineEditor
            key={pipeline.id}
            pipeline={pipeline}
            saving={
              updatePipeline.isPending ||
              createStage.isPending ||
              updateStage.isPending ||
              disableStage.isPending
            }
            onCreateStage={(data) =>
              createStage.mutate({ pipelineId: pipeline.id, data })
            }
            onDisableStage={(stageId) =>
              disableStage.mutate({ pipelineId: pipeline.id, stageId })
            }
            onSavePipeline={(data) =>
              updatePipeline.mutate({ id: pipeline.id, data })
            }
            onSaveStage={(stageId, data) =>
              updateStage.mutate({
                pipelineId: pipeline.id,
                stageId,
                data,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}

function PipelineEditor({
  pipeline,
  saving,
  onSavePipeline,
  onCreateStage,
  onSaveStage,
  onDisableStage,
}: {
  pipeline: Pipeline;
  saving: boolean;
  onSavePipeline: (data: {
    name?: string;
    isDefault?: boolean;
    active?: boolean;
  }) => void;
  onCreateStage: (data: {
    name: string;
    position: number;
    probability: number;
  }) => void;
  onSaveStage: (
    stageId: string,
    data: {
      name?: string;
      position?: number;
      probability?: number;
      active?: boolean;
    },
  ) => void;
  onDisableStage: (stageId: string) => void;
}) {
  const [pipelineName, setPipelineName] = useState(pipeline.name);
  const [stageName, setStageName] = useState('');
  const [position, setPosition] = useState(
    Math.max(0, ...pipeline.stages.map((stage) => stage.position)) + 10,
  );
  const [probability, setProbability] = useState(10);

  useEffect(() => {
    setPipelineName(pipeline.name);
  }, [pipeline.name]);

  return (
    <article className="admin-pipeline-card">
      <header>
        <div>
          <input
            aria-label={`Pipeline name ${pipeline.name}`}
            maxLength={120}
            value={pipelineName}
            onChange={(event) => setPipelineName(event.target.value)}
          />
          <div className="admin-pipeline-badges">
            {pipeline.isDefault && <span>DEFAULT</span>}
            <span>{pipeline.active ? 'ACTIVE' : 'DISABLED'}</span>
          </div>
        </div>
        <div className="admin-row-actions">
          <button
            disabled={saving || !pipelineName.trim()}
            onClick={() => onSavePipeline({ name: pipelineName.trim() })}
            type="button"
          >
            Save
          </button>
          {!pipeline.isDefault && (
            <button
              className="admin-secondary-button"
              disabled={saving}
              onClick={() => onSavePipeline({ isDefault: true, active: true })}
              type="button"
            >
              Make default
            </button>
          )}
          <button
            className="admin-secondary-button"
            disabled={saving || pipeline.isDefault}
            onClick={() => onSavePipeline({ active: !pipeline.active })}
            type="button"
          >
            {pipeline.active ? 'Disable' : 'Enable'}
          </button>
        </div>
      </header>

      <div className="admin-stage-list">
        {pipeline.stages.map((stage) => (
          <StageEditor
            key={stage.id}
            saving={saving}
            stage={stage}
            onDisable={() => onDisableStage(stage.id)}
            onSave={(data) => onSaveStage(stage.id, data)}
          />
        ))}
      </div>

      <div className="admin-new-stage">
        <input
          maxLength={120}
          placeholder="Stage name"
          value={stageName}
          onChange={(event) => setStageName(event.target.value)}
        />
        <input
          aria-label="Stage order"
          min={0}
          placeholder="Order"
          type="number"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
        />
        <input
          aria-label="Stage probability"
          max={100}
          min={0}
          placeholder="%"
          type="number"
          value={probability}
          onChange={(event) => setProbability(Number(event.target.value))}
        />
        <button
          disabled={saving || !stageName.trim()}
          onClick={() => {
            onCreateStage({
              name: stageName.trim(),
              position,
              probability,
            });
            setStageName('');
            setPosition(position + 10);
          }}
          type="button"
        >
          Add stage
        </button>
      </div>
    </article>
  );
}

function StageEditor({
  stage,
  saving,
  onSave,
  onDisable,
}: {
  stage: PipelineStage;
  saving: boolean;
  onSave: (data: {
    name: string;
    position: number;
    probability: number;
    active: boolean;
  }) => void;
  onDisable: () => void;
}) {
  const [name, setName] = useState(stage.name);
  const [position, setPosition] = useState(stage.position);
  const [probability, setProbability] = useState(stage.probability);
  const [active, setActive] = useState(stage.active);

  useEffect(() => {
    setName(stage.name);
    setPosition(stage.position);
    setProbability(stage.probability);
    setActive(stage.active);
  }, [stage]);

  return (
    <div className="admin-stage-row">
      <input
        aria-label={`Stage name ${stage.name}`}
        maxLength={120}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <input
        aria-label={`Stage order ${stage.name}`}
        min={0}
        type="number"
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
      />
      <input
        aria-label={`Stage probability ${stage.name}`}
        max={100}
        min={0}
        type="number"
        value={probability}
        onChange={(event) => setProbability(Number(event.target.value))}
      />
      <label className="admin-toggle admin-toggle-compact">
        <input
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
          type="checkbox"
        />
        Active
      </label>
      <div className="admin-row-actions">
        <button
          disabled={saving || !name.trim()}
          onClick={() =>
            onSave({
              name: name.trim(),
              position,
              probability,
              active,
            })
          }
          type="button"
        >
          Save
        </button>
        {stage.active && (
          <button
            className="admin-secondary-button"
            disabled={saving}
            onClick={onDisable}
            type="button"
          >
            Disable
          </button>
        )}
      </div>
    </div>
  );
}
