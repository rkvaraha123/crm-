import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ApiClient } from '../api-client';
import { Can, useAuthorization } from './authorization-context';

interface Permission {
  id: string;
  key: string;
}
interface Role {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  permissions: { permission: Permission }[];
}
interface Member {
  user: { id: string; email: string; firstName: string; lastName: string };
}

function CustomRoleEditor({
  role,
  permissions,
  api,
  organizationId,
}: {
  role: Role;
  permissions: Permission[];
  api: ApiClient;
  organizationId: string;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(role.name);
  const [selected, setSelected] = useState(
    role.permissions.map(({ permission }) => permission.id),
  );
  useEffect(() => {
    setName(role.name);
    setSelected(role.permissions.map(({ permission }) => permission.id));
  }, [role]);
  const save = useMutation({
    mutationFn: async () => {
      await api(
        `/organizations/${organizationId}/roles/${role.id}`,
        organizationId,
        undefined,
        {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        },
      );
      return api(
        `/organizations/${organizationId}/roles/${role.id}/permissions`,
        organizationId,
        undefined,
        { method: 'PUT', body: JSON.stringify({ permissionIds: selected }) },
      );
    },
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: ['tenant', organizationId, 'roles'],
      }),
  });
  const remove = useMutation({
    mutationFn: () =>
      api(
        `/organizations/${organizationId}/roles/${role.id}`,
        organizationId,
        undefined,
        {
          method: 'DELETE',
        },
      ),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: ['tenant', organizationId, 'roles'],
      }),
  });
  return (
    <div className="mt-4 rounded-lg border border-slate-200 p-4">
      <label className="block font-semibold">
        Role name
        <input
          className="mt-2 w-full rounded border p-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {permissions.map((permission) => (
          <label key={permission.id} className="text-sm">
            <input
              type="checkbox"
              checked={selected.includes(permission.id)}
              onChange={(event) =>
                setSelected((current) =>
                  event.target.checked
                    ? [...current, permission.id]
                    : current.filter((id) => id !== permission.id),
                )
              }
            />{' '}
            {permission.key}
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <button disabled={save.isPending} onClick={() => save.mutate()}>
          Save role
        </button>
        <button disabled={remove.isPending} onClick={() => remove.mutate()}>
          Delete role
        </button>
      </div>
      {(save.isError || remove.isError) && (
        <p role="alert" className="mt-2">
          Role update was denied.
        </p>
      )}
    </div>
  );
}

export function AuthorizationAdmin({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const { can } = useAuthorization();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [userId, setUserId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const enabled = can('settings.read');
  const roles = useQuery({
    queryKey: ['tenant', organizationId, 'roles'],
    queryFn: ({ signal }) =>
      api<Role[]>(
        `/organizations/${organizationId}/roles`,
        organizationId,
        signal,
      ),
    enabled,
  });
  const permissions = useQuery({
    queryKey: ['tenant', organizationId, 'permission-catalog'],
    queryFn: ({ signal }) =>
      api<Permission[]>(
        `/organizations/${organizationId}/permissions`,
        organizationId,
        signal,
      ),
    enabled,
  });
  const members = useQuery({
    queryKey: ['tenant', organizationId, 'members'],
    queryFn: ({ signal }) =>
      api<Member[]>(
        `/organizations/${organizationId}/members`,
        organizationId,
        signal,
      ),
    enabled: enabled && can('users.read'),
  });
  const assignments = useQuery({
    queryKey: ['tenant', organizationId, 'user-roles', userId],
    queryFn: ({ signal }) =>
      api<{ role: Pick<Role, 'id' | 'name' | 'isSystem'> }[]>(
        `/organizations/${organizationId}/users/${userId}/roles`,
        organizationId,
        signal,
      ),
    enabled: enabled && !!userId,
  });
  useEffect(() => {
    setRoleIds(assignments.data?.map(({ role }) => role.id) ?? []);
  }, [assignments.data]);
  const create = useMutation({
    mutationFn: () =>
      api(`/organizations/${organizationId}/roles`, organizationId, undefined, {
        method: 'POST',
        body: JSON.stringify({ name, permissionIds }),
      }),
    onSuccess: async () => {
      setName('');
      setPermissionIds([]);
      await client.invalidateQueries({
        queryKey: ['tenant', organizationId, 'roles'],
      });
    },
  });
  const assign = useMutation({
    mutationFn: () =>
      api(
        `/organizations/${organizationId}/users/${userId}/roles`,
        organizationId,
        undefined,
        { method: 'PUT', body: JSON.stringify({ roleIds }) },
      ),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: ['tenant', organizationId, 'user-roles', userId],
      }),
  });
  if (!enabled) return null;
  if (roles.isPending || permissions.isPending)
    return <p role="status">Loading authorization settings…</p>;
  if (roles.isError || permissions.isError)
    return <p role="alert">Authorization settings are unavailable.</p>;
  return (
    <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-8">
      <h2 className="text-xl font-semibold">Roles &amp; Permissions</h2>
      <ul className="mt-4 space-y-2">
        {roles.data.map((role) => (
          <li key={role.id}>
            <strong>{role.name}</strong>:{' '}
            {role.permissions
              .map(({ permission }) => permission.key)
              .join(', ') || 'No permissions'}
          </li>
        ))}
      </ul>
      <Can permission="settings.update">
        <h3 className="mt-8 font-semibold">Create custom role</h3>
        <input
          aria-label="New role name"
          className="mt-2 w-full rounded border p-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {permissions.data.map((permission) => (
            <label key={permission.id} className="text-sm">
              <input
                type="checkbox"
                checked={permissionIds.includes(permission.id)}
                onChange={(event) =>
                  setPermissionIds((current) =>
                    event.target.checked
                      ? [...current, permission.id]
                      : current.filter((id) => id !== permission.id),
                  )
                }
              />{' '}
              {permission.key}
            </label>
          ))}
        </div>
        <button
          className="mt-4"
          disabled={!name || create.isPending}
          onClick={() => create.mutate()}
        >
          Create role
        </button>
        {roles.data
          .filter((role) => !role.isSystem)
          .map((role) => (
            <CustomRoleEditor
              key={role.id}
              role={role}
              permissions={permissions.data}
              api={api}
              organizationId={organizationId}
            />
          ))}
      </Can>
      {members.data && (
        <div className="mt-8">
          <h3 className="font-semibold">User roles</h3>
          <select
            aria-label="Role assignment user"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          >
            <option value="">Select a user</option>
            {members.data.map(({ user }) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.email})
              </option>
            ))}
          </select>
          {userId && assignments.data && (
            <Can permission="settings.update">
              <div className="mt-3">
                {roles.data.map((role) => (
                  <label key={role.id} className="mr-4 inline-block">
                    <input
                      type="checkbox"
                      checked={roleIds.includes(role.id)}
                      onChange={(event) =>
                        setRoleIds((current) =>
                          event.target.checked
                            ? [...current, role.id]
                            : current.filter((id) => id !== role.id),
                        )
                      }
                    />{' '}
                    {role.name}
                  </label>
                ))}
                <button
                  className="mt-3 block"
                  disabled={assign.isPending}
                  onClick={() => assign.mutate()}
                >
                  Save user roles
                </button>
              </div>
            </Can>
          )}
        </div>
      )}
    </section>
  );
}
