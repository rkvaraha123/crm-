import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '../api-client';

export type CustomFieldEntity = 'COMPANY' | 'CONTACT' | 'LEAD' | 'DEAL' | 'TASK';
export type CustomFieldType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT';

export interface CustomFieldDefinition {
  id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  active: boolean;
  options?: unknown;
  displayOrder: number;
}

export function useCustomFields(
  api: ApiClient,
  organizationId: string,
  entity: CustomFieldEntity,
) {
  return useQuery({
    queryKey: ['tenant', organizationId, 'custom-fields', entity],
    queryFn: ({ signal }) =>
      api<CustomFieldDefinition[]>(
        `/organizations/${organizationId}/config/custom-fields/${entity}`,
        organizationId,
        signal,
      ),
  });
}

export function CustomFieldInputs({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((field) => {
        const value = values[field.key];

        if (field.fieldType === 'BOOLEAN') {
          return (
            <label className="crm-custom-check" key={field.id}>
              <input
                checked={value === true}
                onChange={(event) => onChange(field.key, event.target.checked)}
                type="checkbox"
              />
              <span>{field.label}</span>
            </label>
          );
        }

        if (field.fieldType === 'SELECT') {
          const options = Array.isArray(field.options)
            ? field.options.filter(
                (option): option is string => typeof option === 'string',
              )
            : [];
          return (
            <label className="crm-field" key={field.id}>
              <span>{field.label}</span>
              <select
                required={field.required}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) =>
                  onChange(field.key, event.target.value || undefined)
                }
              >
                <option value="">Choose {field.label}</option>
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (field.fieldType === 'LONG_TEXT') {
          return (
            <label className="crm-field crm-field-wide" key={field.id}>
              <span>{field.label}</span>
              <textarea
                maxLength={5000}
                required={field.required}
                rows={3}
                value={typeof value === 'string' ? value : ''}
                onChange={(event) =>
                  onChange(field.key, event.target.value || undefined)
                }
              />
            </label>
          );
        }

        return (
          <label className="crm-field" key={field.id}>
            <span>{field.label}</span>
            <input
              required={field.required}
              type={
                field.fieldType === 'NUMBER'
                  ? 'number'
                  : field.fieldType === 'DATE'
                    ? 'date'
                    : 'text'
              }
              value={
                typeof value === 'string' || typeof value === 'number'
                  ? String(value)
                  : ''
              }
              onChange={(event) => {
                const raw = event.target.value;
                onChange(
                  field.key,
                  field.fieldType === 'NUMBER'
                    ? raw === ''
                      ? undefined
                      : Number(raw)
                    : raw || undefined,
                );
              }}
            />
          </label>
        );
      })}
    </>
  );
}
