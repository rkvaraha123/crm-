import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './api';
afterEach(() => vi.unstubAllGlobals());
describe('health client', () => {
  it('reads API health', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }))),
    );
    await expect(getHealth()).resolves.toEqual({ status: 'ok' });
  });
  it('reports server failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    );
    await expect(getHealth()).rejects.toThrow('API health request failed');
  });
  it('rejects malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(getHealth()).rejects.toThrow('Invalid health response');
  });
});
