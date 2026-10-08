import { request } from '@/core/api';

/** Only configured provider origins may receive the browser, never credentials. */
export function removalUrl(provider: 'github' | 'google', value: unknown): string {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('url' in value) ||
    typeof value.url !== 'string'
  )
    throw new Error('Invalid removal response');
  const url = new URL(value.url);
  const expected = provider === 'github' ? 'https://github.com' : 'https://accounts.google.com';
  if (url.origin !== expected || url.username || url.password)
    throw new Error('Invalid removal destination');
  return url.href;
}
export async function beginKeyRemoval(provider: 'github' | 'google'): Promise<string> {
  return removalUrl(
    provider,
    await request<unknown>(`/api/auth/key-removal/openai/${provider}`, {
      json: { confirm: 'remove-openai-key' },
      cache: 'no-store',
      credentials: 'same-origin',
    }),
  );
}
export async function removeKeyWithPassword(email: string, password: string): Promise<void> {
  await request<void>('/api/auth/key-removal/openai/password', {
    json: { email: email.trim(), password },
    cache: 'no-store',
    credentials: 'same-origin',
  });
}
