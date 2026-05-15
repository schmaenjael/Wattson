import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import preferArrow from 'eslint-plugin-prefer-arrow';

export default tseslint.config(
  { ignores: ['build/**', 'scripts/migrations/**', 'node_modules/**'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  prettier,
  {
    languageOptions: { ecmaVersion: 'latest' },
    plugins: { 'prefer-arrow': preferArrow },
    rules: {
      'handle-callback-err': 'off',
      'max-nested-callbacks': ['error', { max: 4 }],
      'max-statements-per-line': ['error', { max: 2 }],
      'no-console': 'off',
      'no-empty-function': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-lonely-if': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': ['error', { allow: ['err', 'resolve', 'reject'] }],
      'no-var': 'error',
      'no-undef': 'off',
      'prefer-const': 'error',
      yoda: 'error',
      'prefer-arrow/prefer-arrow-functions': ['error', { singleReturnOnly: false, classPropertiesAllowed: true }],
    },
  },
  {
    // Class methods and interface-required shorthands cannot be arrow functions.
    // prefer-arrow applies only to standalone function expressions/callbacks.
    files: [
      'src/core/commands/**/*.ts',
      'src/core/components/**/*.ts',
      'src/core/events/**/*.ts',
      'src/core/models/**/*.ts',
      'src/core/providers/**/*.ts',
      'src/utilities/**/*.ts',
    ],
    rules: { 'prefer-arrow/prefer-arrow-functions': 'off' },
  }
);
