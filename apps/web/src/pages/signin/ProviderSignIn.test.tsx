import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ProviderSignIn } from './ProviderSignIn';

describe('Provider availability explanations', () => {
  it('names the unconfigured provider instead of offering an unexplained disabled button', () => {
    const html = renderToStaticMarkup(
      <ProviderSignIn
        status="ready"
        providers={{ github: false, google: true }}
        pending={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(html).toContain('GitHub is not configured on this server.');
    expect(html).not.toContain('Google is not configured');
    expect(html).toContain('Refresh availability');
  });
  it('distinguishes a failed lookup from unconfigured credentials', () => {
    const html = renderToStaticMarkup(
      <ProviderSignIn
        status="error"
        providers={{ github: false, google: false }}
        pending={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(html).toContain('Could not check sign-in providers.');
    expect(html).not.toContain('not configured');
    expect(html).toContain('Refresh availability');
  });
  it('explains loading without reporting a configuration failure', () => {
    const html = renderToStaticMarkup(
      <ProviderSignIn
        status="loading"
        providers={{ github: false, google: false }}
        pending={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(html).toContain('Checking sign-in providers');
    expect(html).not.toContain('not configured');
  });
  it('enables both configured buttons without warnings', () => {
    const html = renderToStaticMarkup(
      <ProviderSignIn
        status="ready"
        providers={{ github: true, google: true }}
        pending={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain('not configured');
    expect(html).toContain('Continue with GitHub');
    expect(html).toContain('Continue with Google');
  });
  it('disables provider navigation while a password submission is in flight', () => {
    const html = renderToStaticMarkup(
      <ProviderSignIn
        status="ready"
        providers={{ github: true, google: true }}
        pending
        onRefresh={vi.fn()}
      />,
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
