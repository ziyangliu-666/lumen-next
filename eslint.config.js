// Flat config. One rule set for the whole workspace.
// The import-boundary rule is the load-bearing one: a slice module may use another
// slice only through its public barrel (modules/<name>/index.ts), never by reaching
// into its internals. This keeps the monolith modular and keeps five agents from
// colliding inside one another's folders.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/coverage/**', '**/*.config.*', 'apps/web/**', '.claude/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Block reaching into a slice's internals, but allow its barrel.
              group: ['**/modules/*/*', '!**/modules/*/index.js', '!**/modules/*/index.ts'],
              message:
                'Import a slice only through its public index (modules/<name>), not its internals.',
            },
          ],
        },
      ],
    },
  },
);
