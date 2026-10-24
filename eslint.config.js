// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // QA captures are archived browser-console snippets, not project source.
    ignores: ['dist/*', '.expo/**', 'docs/qa/**'],
  },
  {
    files: ['constants/native-model-sources.ts'],
    rules: {
      // Metro asset IDs require static require() calls in the generated model map.
      '@typescript-eslint/no-require-imports': ['warn', {
        allow: ['^@/assets/3d/native/[^/]+\\.glb$'],
      }],
    },
  },
]);
