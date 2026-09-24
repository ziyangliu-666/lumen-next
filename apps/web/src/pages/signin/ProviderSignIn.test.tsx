import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { offersProviders, ProviderSignIn } from './ProviderSignIn';

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
    // Server configuration does not change while the page is open: no retry to offer.
    expect(html).not.toContain('Try again');
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
    expect(html).toContain('Try again');
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
  it('shows nothing when the server has no provider, instead of dead buttons', () => {
    const html = renderToStaticMarkup(
      <ProviderSignIn
        status="ready"
        providers={{ github: false, google: false }}
        pending={false}
        onRefresh={vi.fn()}
      />,
    );
    expect(html).toBe('');
    expect(offersProviders('ready', { github: false, google: false })).toBe(false);
    // While loading or after a failed lookup the section stays, so the page does not jump.
    expect(offersProviders('loading', { github: false, google: false })).toBe(true);
    expect(offersProviders('error', { github: false, google: false })).toBe(true);
  });
});
