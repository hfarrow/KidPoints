import { defineConfig } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  {
    ignores: [
      '.cache/**',
      '.expo/**',
      'android/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'web-build/**',
    ],
  },
  expoConfig,
]);
