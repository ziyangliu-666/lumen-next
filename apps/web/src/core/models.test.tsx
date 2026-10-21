import { describe, expect, it } from 'vitest';
import { modelLabel } from './models';

describe('model names in the field', () => {
  const models = ['gpt-4.1-nano', 'gpt-4.1-mini', 'gpt-4.1'];

  it('names the default "Auto" and the others by their real names', () => {
    expect(modelLabel(models, 'gpt-4.1-nano')).toBe('Auto');
    expect(modelLabel(models, undefined)).toBe('Auto');
    expect(modelLabel(models, 'gpt-4.1-mini')).toBe('gpt-4.1-mini');
  });
});
