import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { WalletFigures } from './AccountWallet';

it('shows stored spend and a saved zero cap as separate figures, not credit', () => {
  const html = renderToStaticMarkup(
    createElement(WalletFigures, {
      summary: { spent: { dollars: 0.123456 }, cap: { dollars: 0 } },
    }),
  );
  expect(html).toContain('Total spent');
  expect(html).toContain('USD 0.123456');
  expect(html).toContain('Account cap');
  expect(html).toContain('USD 0.0000');
  expect(html).toContain('not a balance');
});
