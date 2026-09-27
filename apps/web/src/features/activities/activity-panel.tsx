import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api-client';
import { useAuthorization } from '../../authorization/authorization-context';

interface Activity {
  id: string;
  type:
    | 'NOTE'
    | 'COMPANY_CREATED'
    | 'COMPANY_UPDATED'
    | 'COMPANY_ARCHIVED'
    | 'CONTACT_CREATED'
    | 'CONTACT_UPDATED'
    | 'CONTACT_ARCHIVED';
  body?: string | null;
  createdAt: string;
  updatedAt: string;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

const label: Record<Activity['type'], string> = {
  NOTE: 'Note',
  COMPANY_CREATED: 'Company created',
  COMPANY_UPDATED: 'Company updated',
  COMPANY_ARCHIVED: 'Company archived',
  CONTACT_CREATED: 'Contact created',
  CONTACT_UPDATED: 'Contact updated',
  CONTACT_ARCHIVED: 'Contact archived',
};

export function ActivityPanel({
  api,
  organizationId,
  subjectKind,
  subjectId,
  title,
}: {
  api: ApiClient;
  organizationId: string;
  subjectKind: 'companies' | 'contacts';
  subjectId: string;
  title: string;
}) {
  const { can } = useAuthorization();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  const key = ['tenant', organizationId, subjectKind, subjectId, 'activities'];

  const activities = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      api<Activity[]>(
        `/organizations/${organizationId}/${subjectKind}/${subjectId}/activities?limit=50`,
        organizationId,
        signal,
      ),
    enabled: can('activities.read'),
  });

  const createNote = useMutation({
    mutationFn: () =>
      api<Activity>(
        `/organizations/${organizationId}/${subjectKind}/${subjectId}/notes`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({ body }),
        },
      ),
    onSuccess: async () => {
      setBody('');
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const updateNote = useMutation({
    mutationFn: ({
      activityId,
      nextBody,
    }: {
      activityId: string;
      nextBody: string;
    }) =>
      api<Activity>(
        `/organizations/${organizationId}/${subjectKind}/${subjectId}/notes/${activityId}`,
        organizationId,
        undefined,
        {
          method: 'PATCH',
          body: JSON.stringify({ body: nextBody }),
        },
      ),
    onSuccess: async () => {
      setEditingId(null);
      setEditingBody('');
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const archiveNote = useMutation({
    mutationFn: (activityId: string) =>
      api<Activity>(
        `/organizations/${organizationId}/${subjectKind}/${subjectId}/notes/${activityId}`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  if (!can('activities.read')) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (body.trim()) createNote.mutate();
  }

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-slate-600">Activity timeline</p>
        </div>
      </div>

      {can('notes.create') && (
        <form className="mt-4 flex gap-3" onSubmit={submit}>
          <textarea
            aria-label="New note"
            className="min-h-24 flex-1 rounded-lg border border-slate-300 bg-white p-3"
            maxLength={10000}
            placeholder="Add a note"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <button
            className="self-end"
            disabled={createNote.isPending || !body.trim()}
            type="submit"
          >
            {createNote.isPending ? 'Adding…' : 'Add note'}
          </button>
        </form>
      )}

      {activities.isPending ? (
        <p className="mt-4" role="status">
          Loading activity…
        </p>
      ) : activities.isError ? (
        <p className="mt-4" role="alert">
          Activity is unavailable.
        </p>
      ) : activities.data.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No activity yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {activities.data.map((activity) => (
            <li
              className="rounded-lg border border-slate-200 bg-white p-3"
              key={activity.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{label[activity.type]}</strong>
                <span className="text-xs text-slate-500">
                  {new Date(activity.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {activity.actor.firstName} {activity.actor.lastName}
              </p>

              {activity.type === 'NOTE' &&
                (editingId === activity.id ? (
                  <div className="mt-3">
                    <textarea
                      aria-label="Edit note"
                      className="min-h-20 w-full rounded-lg border border-slate-300 p-3"
                      maxLength={10000}
                      value={editingBody}
                      onChange={(event) => setEditingBody(event.target.value)}
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        disabled={updateNote.isPending || !editingBody.trim()}
                        onClick={() =>
                          updateNote.mutate({
                            activityId: activity.id,
                            nextBody: editingBody,
                          })
                        }
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditingBody('');
                        }}
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="mt-3 whitespace-pre-wrap">{activity.body}</p>
                    <div className="mt-3 flex gap-2">
                      {can('notes.update') && (
                        <button
                          onClick={() => {
                            setEditingId(activity.id);
                            setEditingBody(activity.body ?? '');
                          }}
                          type="button"
                        >
                          Edit
                        </button>
                      )}
                      {can('notes.delete') && (
                        <button
                          disabled={archiveNote.isPending}
                          onClick={() => archiveNote.mutate(activity.id)}
                          type="button"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </>
                ))}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
