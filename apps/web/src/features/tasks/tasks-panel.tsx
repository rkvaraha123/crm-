import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';
import {
  CustomFieldInputs,
  useCustomFields,
} from '../../custom-fields/custom-field-inputs';

interface Task {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  assigneeId: string;
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface Member {
  userId: string;
  status: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const priorities: Task['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const statuses: Task['status'][] = [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
];

export function TasksPanel({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const { can } = useAuthorization();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM');
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});

  const fields = useCustomFields(api, organizationId, 'TASK');
  const tasks = useQuery({
    queryKey: ['tenant', organizationId, 'tasks', search],
    queryFn: ({ signal }) =>
      api<Task[]>(
        `/organizations/${organizationId}/tasks?limit=200&search=${encodeURIComponent(search)}`,
        organizationId,
        signal,
      ),
    enabled: can('tasks.read'),
  });

  const members = useQuery({
    queryKey: ['tenant', organizationId, 'task-members'],
    queryFn: ({ signal }) =>
      api<Member[]>(
        `/organizations/${organizationId}/members?limit=200`,
        organizationId,
        signal,
      ),
    enabled: can('tasks.assign') && can('users.read'),
  });

  const create = useMutation({
    mutationFn: () =>
      api<Task>(
        `/organizations/${organizationId}/tasks`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            title,
            priority,
            ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
            customFields,
          }),
        },
      ),
    onSuccess: async () => {
      setTitle('');
      setDueAt('');
      setPriority('MEDIUM');
      setCustomFields({});
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'tasks'],
      });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task['status'] }) =>
      api<Task>(
        `/organizations/${organizationId}/tasks/${id}`,
        organizationId,
        undefined,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'tasks'],
      }),
  });

  const assign = useMutation({
    mutationFn: ({ id, assigneeId }: { id: string; assigneeId: string }) =>
      api<Task>(
        `/organizations/${organizationId}/tasks/${id}/assignee`,
        organizationId,
        undefined,
        { method: 'PATCH', body: JSON.stringify({ assigneeId }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'tasks'],
      }),
  });

  const archive = useMutation({
    mutationFn: (id: string) =>
      api<Task>(
        `/organizations/${organizationId}/tasks/${id}`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'tasks'],
      }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (title.trim()) create.mutate();
  }

  return (
    <section className="crm-module-page">
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">Productivity</p>
          <h1>Tasks</h1>
          <p>Keep follow-ups, deadlines, and ownership inside the CRM.</p>
        </div>
        <input
          aria-label="Search tasks"
          className="crm-search-input"
          placeholder="Search tasks"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {can('tasks.create') && (
        <form className="crm-record-form" onSubmit={submit}>
          <label className="crm-field crm-field-wide">
            <span>Task</span>
            <input
              maxLength={180}
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Due</span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <label className="crm-field">
            <span>Priority</span>
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as Task['priority'])
              }
            >
              {priorities.map((item) => (
                <option key={item} value={item}>
                  {item}
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
            <button disabled={create.isPending || !title.trim()} type="submit">
              {create.isPending ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      )}

      {tasks.isPending ? (
        <p role="status">Loading tasks…</p>
      ) : tasks.isError ? (
        <p role="alert">Tasks are unavailable.</p>
      ) : tasks.data.length === 0 ? (
        <div className="crm-empty-state">
          <strong>No tasks found</strong>
          <p>Create a follow-up to start organizing the team workload.</p>
        </div>
      ) : (
        <div className="crm-table-wrap">
          <table className="crm-data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.data.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                    <small>{task.description || 'No description'}</small>
                  </td>
                  <td>
                    {task.dueAt
                      ? new Date(task.dueAt).toLocaleString()
                      : 'No due date'}
                  </td>
                  <td>{task.priority}</td>
                  <td>
                    {can('tasks.update') ? (
                      <select
                        aria-label={`Status for ${task.title}`}
                        value={task.status}
                        onChange={(event) =>
                          update.mutate({
                            id: task.id,
                            status: event.target.value as Task['status'],
                          })
                        }
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    ) : (
                      task.status
                    )}
                  </td>
                  <td>
                    {can('tasks.assign') && members.data ? (
                      <select
                        aria-label={`Assignee for ${task.title}`}
                        value={task.assigneeId}
                        onChange={(event) =>
                          assign.mutate({
                            id: task.id,
                            assigneeId: event.target.value,
                          })
                        }
                      >
                        {members.data
                          .filter((member) => member.status === 'ACTIVE')
                          .map((member) => (
                            <option key={member.user.id} value={member.user.id}>
                              {member.user.firstName} {member.user.lastName}
                            </option>
                          ))}
                      </select>
                    ) : (
                      `${task.assignee.firstName} ${task.assignee.lastName}`
                    )}
                  </td>
                  <td>
                    {can('tasks.delete') && (
                      <button
                        className="crm-text-button"
                        disabled={archive.isPending}
                        onClick={() => archive.mutate(task.id)}
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
