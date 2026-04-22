import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.config.js',
    '**/*.config.mjs',
    '**/*.config.ts',
  ]),

  // packages/core — pure logic, Node environment, no DOM
  {
    files: ['packages/core/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      // CLAUDE.md preference: no `any`, ever.
      '@typescript-eslint/no-explicit-any': 'error',
      // CLAUDE.md preference: no default exports.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Named exports only — no default exports (repo convention).',
        },
      ],
    },
  },

  // packages/web — browser adapters + entry point, DOM types available
  {
    files: ['packages/web/src/**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportDefaultDeclaration',
          message: 'Named exports only — no default exports (repo convention).',
        },
      ],
    },
  },

  // Relax a few rules in test files (mocks, test-only shapes).
  {
    files: ['packages/*/src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Keep Prettier-compatible rules last so formatting rules are disabled
  // and Prettier owns whitespace / quotes / semicolons / line wrapping.
  prettier,
])
