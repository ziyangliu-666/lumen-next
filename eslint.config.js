// Flat config. One rule set for the whole workspace.
// Two rules are load-bearing, one per side of the wire.
// Server: a slice module may use another slice only through its public barrel
// (modules/<name>/index.ts), never by reaching into its internals.
// Web: a page may only build from `src/ui` and `src/core`, using theme tokens.
// Both exist for the same reason — five people and five agents write here at the
// same time, and neither collisions nor five private colour schemes are wanted.
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/*.config.*',
      '.claude/**',
      // Plain Node build scripts, outside every tsconfig.
      'apps/server/scripts/**',
      // The status board: one static page and its data, read by a browser as they are.
      'docs/status/**',
      // Files the web server sends to the browser byte for byte (theme-init.js
      // runs before the bundle, so it cannot be TypeScript).
      'apps/web/public/**',
      // Local design prototypes, not in the repository (see .gitignore).
      'design/**',
      // Review records, kept as the agents returned them; the workflow scripts are not built.
      'reports/**',
      // Vendored shadcn/ui sources. They are updated by `npx shadcn add`, not by
      // hand, so our house rules would only fight the generator.
      'apps/web/src/ui/**',
    ],
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
  // The server: one logger (core/log), never console.
  {
    files: ['apps/server/src/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
  // The web app: React rules, accessibility, and the theme.
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, jsxA11y.flatConfigs.recommended],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="style"]',
          message:
            'No inline styles. Use a Tailwind utility built from the theme, or add a variant to the component in src/ui.',
        },
        {
          selector: 'Literal[value=/\\[#[0-9a-fA-F]{3}/]',
          message:
            'No hex colour in a class name. Use a theme colour (bg-surface, text-muted-foreground, text-keep, …) from src/styles/theme.css.',
        },
        {
          selector: 'TemplateElement[value.raw=/\\[#[0-9a-fA-F]{3}/]',
          message:
            'No hex colour in a class name. Use a theme colour (bg-surface, text-muted-foreground, text-keep, …) from src/styles/theme.css.',
        },
      ],
    },
  },
  // A page owns its own folder and nothing else.
  {
    files: ['apps/web/src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/pages/*', '**/pages/*/*'],
              message:
                'A page may not import another page. Share it through @/ui (a component) or @/core (the shell), and ask that owner first.',
            },
          ],
        },
      ],
    },
  },
);
