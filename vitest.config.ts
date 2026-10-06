import { defineConfig } from 'vitest/config';
import path from 'path';

// Guard: refuse to run tests if not using a test database
const testDbUrl = process.env.TEST_DATABASE_URL;
if (testDbUrl && !testDbUrl.includes('_test')) {
  throw new Error('TEST_DATABASE_URL must point to a database ending in "_test"');
}

// Setup: use TEST_DATABASE_URL as DATABASE_URL for tests
if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
}

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/__tests__/__mocks__/server-only.ts'),
    },
  },
});
