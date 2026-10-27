import { expect, it } from 'vitest';
import { formatMoney } from './formatMoney';

it.each([
  [0, '0.0000'],
  [1, '1.0000'],
  [0.000001, '0.000001'],
  [0.00001, '0.00001'],
  [0.123456, '0.123456'],
  [1.0001, '1.0001'],
  [999999.999999, '999999.999999'],
])('displays %s without rounding away stored precision', (dollars, expected) => {
  expect(formatMoney({ dollars })).toBe(expected);
});
