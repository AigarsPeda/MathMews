// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/**'],
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
