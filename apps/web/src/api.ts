export type HealthResponse = { status: 'ok' };
const baseUrl = (
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1'
).replace(/\/$/, '');
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/health`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('API health request failed');
  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('status' in data) ||
    data.status !== 'ok'
  )
    throw new Error('Invalid health response');
  return { status: 'ok' };
}
