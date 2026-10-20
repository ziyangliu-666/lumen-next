import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { LedgerRows } from './AdminLedger';

it('renders the deleted owner label beside the retained account ID and amount', () => {
  const html = renderToStaticMarkup(
    createElement(LedgerRows, {
      entries: [
        {
          id: 'entry',
          accountId: 'original-owner',
          accountLabel: 'Deleted account',
          taskId: null,
          amount: { dollars: 0.123456 },
          createdAt: '2026-10-03T12:00:00Z',
        },
      ],
    }),
  );
  expect(html).toContain('Deleted account');
  expect(html).toContain('original-owner');
  expect(html).toContain('$0.123456');
  expect(html).not.toContain('<a');
});
