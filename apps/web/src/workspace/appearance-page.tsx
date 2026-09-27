import { FormEvent, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../api-client';
import {
  DEFAULT_APPEARANCE,
  OrganizationAppearance,
  contrastColor,
} from './appearance';

const editableFields = [
  {
    key: 'primaryColor',
    label: 'Primary color',
    help: 'Buttons, highlights, and key actions.',
  },
  {
    key: 'accentColor',
    label: 'Accent color',
    help: 'Active navigation and status accents.',
  },
  {
    key: 'sidebarColor',
    label: 'Sidebar color',
    help: 'Main navigation background.',
  },
  {
    key: 'pageBackground',
    label: 'Page background',
    help: 'Workspace canvas background.',
  },
  {
    key: 'surfaceColor',
    label: 'Card color',
    help: 'Dashboard cards and content surfaces.',
  },
] as const;

export function AppearancePage({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OrganizationAppearance>({
    ...DEFAULT_APPEARANCE,
    organizationId,
  });

  const appearance = useQuery({
    queryKey: ['tenant', organizationId, 'appearance'],
    queryFn: ({ signal }) =>
      api<OrganizationAppearance>(
        `/organizations/${organizationId}/appearance`,
        organizationId,
        signal,
      ),
  });

  useEffect(() => {
    if (appearance.data) setDraft(appearance.data);
  }, [appearance.data]);

  const save = useMutation({
    mutationFn: () =>
      api<OrganizationAppearance>(
        `/organizations/${organizationId}/appearance`,
        organizationId,
        undefined,
        {
          method: 'PUT',
          body: JSON.stringify({
            workspaceName: draft.workspaceName,
            primaryColor: draft.primaryColor,
            accentColor: draft.accentColor,
            sidebarColor: draft.sidebarColor,
            pageBackground: draft.pageBackground,
            surfaceColor: draft.surfaceColor,
          }),
        },
      ),
    onSuccess: async (saved) => {
      setDraft(saved);
      queryClient.setQueryData(
        ['tenant', organizationId, 'appearance'],
        saved,
      );
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'appearance'],
      });
    },
  });

  const reset = useMutation({
    mutationFn: () =>
      api<OrganizationAppearance>(
        `/organizations/${organizationId}/appearance`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: async (saved) => {
      setDraft(saved);
      queryClient.setQueryData(
        ['tenant', organizationId, 'appearance'],
        saved,
      );
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'appearance'],
      });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  const previewStyle = {
    '--preview-primary': draft.primaryColor,
    '--preview-accent': draft.accentColor,
    '--preview-sidebar': draft.sidebarColor,
    '--preview-page': draft.pageBackground,
    '--preview-surface': draft.surfaceColor,
    '--preview-sidebar-text': contrastColor(draft.sidebarColor),
    '--preview-surface-text': contrastColor(draft.surfaceColor),
  } as CSSProperties;

  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Admin panel</p>
          <h1>Appearance</h1>
          <p>
            Control the CRM brand colors for this organization without editing
            code.
          </p>
        </div>
      </div>

      {appearance.isPending ? (
        <p role="status">Loading appearance settings…</p>
      ) : appearance.isError ? (
        <p role="alert">Appearance settings could not be loaded.</p>
      ) : (
        <div className="crm-appearance-layout">
          <form className="crm-surface" onSubmit={submit}>
            <div className="crm-section-heading">
              <div>
                <p className="crm-page-kicker">Brand settings</p>
                <h2>Workspace theme</h2>
              </div>
            </div>

            <label className="crm-field">
              Workspace name
              <input
                maxLength={80}
                required
                value={draft.workspaceName}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    workspaceName: event.target.value,
                  }))
                }
              />
              <small>Shown in the CRM sidebar.</small>
            </label>

            <div className="crm-color-grid">
              {editableFields.map(({ key, label, help }) => (
                <label className="crm-color-field" key={key}>
                  <span>
                    <strong>{label}</strong>
                    <small>{help}</small>
                  </span>
                  <span className="crm-color-control">
                    <input
                      aria-label={label}
                      type="color"
                      value={draft[key]}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                    />
                    <code>{draft[key]}</code>
                  </span>
                </label>
              ))}
            </div>

            <div className="crm-form-actions">
              <button disabled={save.isPending} type="submit">
                {save.isPending ? 'Saving…' : 'Save appearance'}
              </button>
              <button
                className="crm-secondary-button"
                disabled={reset.isPending}
                onClick={() => reset.mutate()}
                type="button"
              >
                {reset.isPending ? 'Resetting…' : 'Reset to default'}
              </button>
            </div>

            {save.isSuccess && (
              <p className="crm-success-message" role="status">
                Appearance saved.
              </p>
            )}
            {(save.isError || reset.isError) && (
              <p className="crm-alert" role="alert">
                Appearance could not be updated.
              </p>
            )}
          </form>

          <section className="crm-surface">
            <div className="crm-section-heading">
              <div>
                <p className="crm-page-kicker">Preview</p>
                <h2>Live theme preview</h2>
              </div>
            </div>
            <div className="crm-theme-preview" style={previewStyle}>
              <aside>
                <strong>{draft.workspaceName || 'RK Varaha CRM'}</strong>
                <span className="is-active">Dashboard</span>
                <span>Companies</span>
                <span>Contacts</span>
                <span>Team</span>
              </aside>
              <div className="crm-theme-preview-page">
                <div className="crm-theme-preview-card">
                  <small>Companies</small>
                  <strong>24</strong>
                </div>
                <div className="crm-theme-preview-card">
                  <small>Contacts</small>
                  <strong>87</strong>
                </div>
                <button type="button">Primary action</button>
              </div>
            </div>
            <p className="crm-muted-note">
              Preview numbers are visual placeholders only. Saving changes
              affects colors and branding, not CRM data.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
