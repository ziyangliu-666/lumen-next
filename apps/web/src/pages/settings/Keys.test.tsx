import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { Keys } from './Keys';
it('discloses own-provider billing, wallet limits and fail-closed behavior before collecting a key', () => {
  const html = renderToStaticMarkup(<Keys />);
  expect(html).toContain('OpenAI bills your own account');
  expect(html).toContain('applies your Lumen spending cap');
  expect(html).toContain('does not silently switch');
  expect(html).toContain('Loading key status');
  expect(html).not.toContain('id="openai-key"');
});
