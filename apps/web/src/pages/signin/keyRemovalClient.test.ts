import { afterEach, expect, it, vi } from 'vitest';
import { beginKeyRemoval, removalUrl, removeKeyWithPassword } from './keyRemovalClient';
afterEach(() => vi.unstubAllGlobals());
it('accepts only the selected provider HTTPS origin', () => {
  expect(
    removalUrl('github', { url: 'https://github.com/login/oauth/authorize?state=kr.fixture' }),
  ).toContain('github.com');
  for (const url of [
    'http://github.com/login',
    'https://github.com.evil.test/',
    'https://user:pass@github.com/',
    'https://accounts.google.com/',
    'javascript:alert(1)',
  ])
    expect(() => removalUrl('github', { url })).toThrow();
  expect(() => removalUrl('google', {})).toThrow();
  expect(removalUrl('google', { url: 'https://accounts.google.com/o/oauth2/v2/auth' })).toContain(
    'accounts.google.com',
  );
});
it('posts explicit removal proof without issuing an auth-changed event or putting credentials in URLs', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetcher);
  await removeKeyWithPassword(' owner@example.test ', 'synthetic-password');
  expect(fetcher).toHaveBeenCalledWith(
    '/api/auth/key-removal/openai/password',
    expect.objectContaining({
      method: 'POST',
      cache: 'no-store',
      body: JSON.stringify({ email: 'owner@example.test', password: 'synthetic-password' }),
    }),
  );
  fetcher.mockResolvedValue(
    new Response(JSON.stringify({ url: 'https://github.com/login/oauth/authorize?state=kr.test' })),
  );
  await expect(beginKeyRemoval('github')).resolves.toContain('https://github.com/');
  expect(fetcher).toHaveBeenLastCalledWith(
    '/api/auth/key-removal/openai/github',
    expect.objectContaining({ body: JSON.stringify({ confirm: 'remove-openai-key' }) }),
  );
});
