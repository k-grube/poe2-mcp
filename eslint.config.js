import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactYouMightNotNeedAnEffect from 'eslint-plugin-react-you-might-not-need-an-effect'
import reactCompiler from 'eslint-plugin-react-compiler'

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  reactYouMightNotNeedAnEffect.configs.strict,
  reactCompiler.configs.recommended,
  eslintConfigPrettier,
  {
    ignores: [
      '**/dist/',
      '**/build/',
      '**/node_modules/',
      '**/coverage/',
      '**/*.min.{js,mjs,cjs}',
      '**/*.bundle.js',
      // vendored PoB source — not ours
      'pob2/',
      // lua side has its own style
      'lua/',
      // fixtures / generated
      'tests/test-build',
      'tests/*.xml',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/ban-ts-comment': 'warn',
      curly: ['error', 'all'],
      'no-nested-ternary': 'error',
      // semi: 'never' rules out trailing `;`, semi-style: 'last' rules out leading `;`.
      // together they force restructuring (extract temp, fix the underlying cast)
      // instead of letting a defender semi slip in via `;(expr).method()`.
      semi: ['error', 'never', { beforeStatementContinuationChars: 'never' }],
      'semi-style': ['error', 'last'],
      'no-extra-semi': 'error',
    },
  },
  {
    files: ['**/*.{jsx,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/display-name': 'warn',
    },
    settings: { react: { version: 'detect' } },
  },
  {
    // node-side globals for the MCP server and scripts (src/web is browser-side)
    files: ['src/**/*.ts', 'scripts/**/*.ts', 'tests/**/*.ts'],
    ignores: ['src/web/**'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // node 22+ has these globally — eslint doesn't infer from engines
        URLSearchParams: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
  },
)
