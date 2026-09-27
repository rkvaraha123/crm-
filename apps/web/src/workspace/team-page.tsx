import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../api-client';
import { useAuthorization } from '../authorization/authorization-context';

interface Team {
  id: string;
  name: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

interface Member {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
  };
}

export function TeamPage({
  api,
  organizationId,
}: {
  api: ApiClient;
  organizationId: string;
}) {
  const { can } = useAuthorization();
  const queryClient = useQueryClient();
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberToAdd, setMemberToAdd] = useState('');

  const teams = useQuery({
    queryKey: ['tenant', organizationId, 'teams'],
    queryFn: ({ signal }) =>
      api<Team[]>(
        `/organizations/${organizationId}/teams?limit=100`,
        organizationId,
        signal,
      ),
  });

  const members = useQuery({
    queryKey: ['tenant', organizationId, 'members'],
    queryFn: ({ signal }) =>
      api<Member[]>(
        `/organizations/${organizationId}/members?limit=100`,
        organizationId,
        signal,
      ),
    enabled: can('users.read'),
  });

  const teamMembers = useQuery({
    queryKey: ['tenant', organizationId, 'teams', selectedTeamId, 'members'],
    queryFn: ({ signal }) =>
      api<Member[]>(
        `/organizations/${organizationId}/teams/${selectedTeamId}/members?limit=100`,
        organizationId,
        signal,
      ),
    enabled: !!selectedTeamId,
  });

  const createTeam = useMutation({
    mutationFn: () =>
      api<Team>(
        `/organizations/${organizationId}/teams`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            ...(description.trim() ? { description } : {}),
          }),
        },
      ),
    onSuccess: async (team) => {
      setName('');
      setDescription('');
      setSelectedTeamId(team.id);
      await queryClient.invalidateQueries({
        queryKey: ['tenant', organizationId, 'teams'],
      });
    },
  });

  const addMember = useMutation({
    mutationFn: () =>
      api<Member>(
        `/organizations/${organizationId}/teams/${selectedTeamId}/members`,
        organizationId,
        undefined,
        {
          method: 'POST',
          body: JSON.stringify({ userId: memberToAdd }),
        },
      ),
    onSuccess: async () => {
      setMemberToAdd('');
      await queryClient.invalidateQueries({
        queryKey: [
          'tenant',
          organizationId,
          'teams',
          selectedTeamId,
          'members',
        ],
      });
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api<{ removed: boolean }>(
        `/organizations/${organizationId}/teams/${selectedTeamId}/members/${userId}`,
        organizationId,
        undefined,
        { method: 'DELETE' },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [
          'tenant',
          organizationId,
          'teams',
          selectedTeamId,
          'members',
        ],
      }),
  });

  const selectedTeam = teams.data?.find((team) => team.id === selectedTeamId);
  const assignedIds = useMemo(
    () => new Set(teamMembers.data?.map(({ user }) => user.id) ?? []),
    [teamMembers.data],
  );
  const availableMembers =
    members.data?.filter(
      ({ user }) => user.status === 'ACTIVE' && !assignedIds.has(user.id),
    ) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) createTeam.mutate();
  }

  return (
    <section>
      <div className="crm-page-heading">
        <div>
          <p className="crm-page-kicker">People &amp; access</p>
          <h1>Team</h1>
          <p>Organize members into teams used by TEAM record scope.</p>
        </div>
      </div>

      <div className="crm-dashboard-grid">
        <section className="crm-surface">
          <div className="crm-section-heading">
            <div>
              <p className="crm-page-kicker">Teams</p>
              <h2>Workspace teams</h2>
            </div>
          </div>

          {can('teams.create') && (
            <form className="crm-form-grid" onSubmit={submit}>
              <label>
                Team name
                <input
                  maxLength={100}
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Description
                <input
                  maxLength={1000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </label>
              <button
                disabled={createTeam.isPending || !name.trim()}
                type="submit"
              >
                {createTeam.isPending ? 'Creating…' : 'Create team'}
              </button>
            </form>
          )}

          {teams.isPending ? (
            <p role="status">Loading teams…</p>
          ) : teams.isError ? (
            <p role="alert">Teams are unavailable.</p>
          ) : teams.data.length === 0 ? (
            <div className="crm-empty-state">
              <strong>No teams yet</strong>
              <p>Create a team to start using team-level CRM access.</p>
            </div>
          ) : (
            <div className="crm-list">
              {teams.data.map((team) => (
                <button
                  className={
                    selectedTeamId === team.id
                      ? 'crm-list-row is-selected'
                      : 'crm-list-row'
                  }
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id)}
                  type="button"
                >
                  <span>
                    <strong>{team.name}</strong>
                    <small>{team.description || 'No description'}</small>
                  </span>
                  <span className="crm-badge">{team.status}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="crm-surface">
          <div className="crm-section-heading">
            <div>
              <p className="crm-page-kicker">Membership</p>
              <h2>{selectedTeam ? selectedTeam.name : 'Select a team'}</h2>
            </div>
          </div>

          {!selectedTeamId ? (
            <div className="crm-empty-state">
              <strong>No team selected</strong>
              <p>Select a team to view and manage its members.</p>
            </div>
          ) : (
            <>
              {can('teams.update') && can('users.read') && (
                <div className="crm-inline-form">
                  <select
                    aria-label="Add team member"
                    value={memberToAdd}
                    onChange={(event) => setMemberToAdd(event.target.value)}
                  >
                    <option value="">Select member</option>
                    {availableMembers.map(({ user }) => (
                      <option key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={addMember.isPending || !memberToAdd}
                    onClick={() => addMember.mutate()}
                    type="button"
                  >
                    Add member
                  </button>
                </div>
              )}

              {teamMembers.isPending ? (
                <p role="status">Loading team members…</p>
              ) : teamMembers.isError ? (
                <p role="alert">Team members are unavailable.</p>
              ) : teamMembers.data.length === 0 ? (
                <div className="crm-empty-state">
                  <strong>No members assigned</strong>
                  <p>Add active organization members to this team.</p>
                </div>
              ) : (
                <div className="crm-member-list">
                  {teamMembers.data.map(({ user }) => (
                    <div className="crm-member-row" key={user.id}>
                      <div className="crm-avatar">
                        {user.firstName.slice(0, 1)}
                        {user.lastName.slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong>
                          {user.firstName} {user.lastName}
                        </strong>
                        <span>{user.email}</span>
                      </div>
                      {can('teams.update') && (
                        <button
                          className="crm-text-button"
                          disabled={removeMember.isPending}
                          onClick={() => removeMember.mutate(user.id)}
                          type="button"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
