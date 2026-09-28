import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DeleteAccountView, type DeleteAccountViewProps } from './DeleteAccountSection';

function render(props: Partial<DeleteAccountViewProps> = {}): string {
  return renderToStaticMarkup(
    <DeleteAccountView
      currentPassword=""
      pending={false}
      error=""
      onPasswordChange={vi.fn()}
      onConfirm={vi.fn()}
      {...props}
    />,
  );
}

describe('Delete account section', () => {
  it('asks for reauthentication and puts the destructive action behind a confirmation', () => {
    const html = render();
    expect(html).toContain('Delete account');
    expect(html).toContain('cannot be undone');
    expect(html).toContain('id="delete-account-password"');
    expect(html).toContain('type="password"');
    // The trigger opens a dialog; the action that deletes is not on the page yet.
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain('Delete permanently');
    expect(html).not.toContain('role="alert"');
  });

  it('shows a refused reauthentication as an alert', () => {
    const html = render({ error: 'Deletion refused. Enter your current password.' });
    expect(html).toContain('role="alert"');
    expect(html).toContain('Deletion refused. Enter your current password.');
  });

  it('disables the controls while the request is in flight', () => {
    const html = render({ pending: true });
    expect(html).toContain('Deleting…');
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
