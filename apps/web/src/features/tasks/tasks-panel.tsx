import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';

interface Task {
  id: string;
  title: string;
  dueAt?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  assignee: { firstName: string; lastName: string };
}

export function TasksPanel({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const { can } = useAuthorization();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');

  const tasks = useQuery({
    queryKey: ['tenant', organizationId, 'tasks'],
    queryFn: ({ signal }) =>
      api<Task[]>(
        `/organizations/${organizationId}/tasks`,
        organizationId,
        signal,
      ),
    enabled: can('tasks.read'),
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
            ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
          }),
        },
      ),
    onSuccess: async () => {
      setTitle('');
      setDueAt('');
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
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
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
    <section className="crm-module-card">
      <div className="crm-module-heading">
        <div>
          <p className="crm-page-kicker">Productivity</p>
          <h1>Tasks</h1>
          <p>Manage follow-ups and customer work.</p>
        </div>
      </div>

      {can('tasks.create') && (
        <form className="crm-inline-form" onSubmit={submit}>
          <input
            placeholder="Task title"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            aria-label="Due date"
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
          <button disabled={create.isPending} type="submit">
            Add task
          </button>
        </form>
      )}

      {tasks.isPending ? (
        <p role="status">Loading tasks…</p>
      ) : tasks.isError ? (
        <p role="alert">Tasks are unavailable.</p>
      ) : (
        <div className="crm-data-table-wrap">
          <table className="crm-data-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {tasks.data.map((task) => (
                <tr key={task.id}>
                  <td>
                    <strong>{task.title}</strong>
                  </td>
                  <td>
                    {task.dueAt ? new Date(task.dueAt).toLocaleString() : '—'}
                  </td>
                  <td>{task.priority}</td>
                  <td>
                    <select
                      disabled={!can('tasks.update')}
                      value={task.status}
                      onChange={(event) =>
                        update.mutate({
                          id: task.id,
                          status: event.target.value as Task['status'],
                        })
                      }
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELED">Canceled</option>
                    </select>
                  </td>
                  <td>
                    {task.assignee.firstName} {task.assignee.lastName}
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
