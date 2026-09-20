export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 401
        ? 'Sign-in required'
        : status === 403
          ? 'CRM access is not permitted. Contact your administrator.'
          : 'Request failed',
    );
  }
}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  membershipStatus: 'ACTIVE';
}
export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizations: Organization[];
}
export function createApiClient(
  getToken: () => Promise<string>,
  onUnauthorized: () => void,
  base = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1',
) {
  return async function api<T>(
    path: string,
    organizationId?: string,
    signal?: AbortSignal,
  ): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//'))
      throw new Error('Relative API path required');
    const token = await getToken();
    const response = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(organizationId ? { 'X-Organization-Id': organizationId } : {}),
      },
      signal: signal ?? AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (response.status === 401) onUnauthorized();
      throw new ApiError(response.status);
    }
    return response.json() as Promise<T>;
  };
}
export function selectOrganization(
  organizations: Organization[],
  selected: string | null,
): string | null {
  if (
    selected &&
    organizations.some((organization) => organization.id === selected)
  )
    return selected;
  return organizations.length === 1 ? organizations[0].id : null;
}
