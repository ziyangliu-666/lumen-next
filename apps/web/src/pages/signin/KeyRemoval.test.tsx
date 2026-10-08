import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { KeyRemoval } from './KeyRemoval';
it('requires explicit action-specific proof and offers only enabled providers', () => {
  const html = renderToStaticMarkup(
    <KeyRemoval providers={{ github: true, google: false }} onBack={() => undefined} />,
  );
  expect(html).toContain('Confirm removal with password');
  expect(html).toContain('Confirm removal with GitHub');
  expect(html).not.toContain('Confirm removal with Google');
  expect(html).toContain('type="password"');
  expect(html).toContain('does not sign you in');
});
