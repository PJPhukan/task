import { beforeAll } from 'vitest';
import { Pool } from 'pg';
import { getEnv } from './src/server/config/env';
import { reseedDatabase } from './src/__tests__/__helpers__/seed';

beforeAll(async () => {
  // Force AUTH_MODE=dev for tests, regardless of .env.local
  process.env.AUTH_MODE = 'dev';

  const env = getEnv();
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  // Parse the database name from the connection string
  // Format: postgresql://user:password@host:port/dbname?params
  const match = databaseUrl.match(/\/([^/?]+)(?:\?|$)/);
  const dbName = match ? match[1] : '';

  console.log(`Using database: ${dbName}`);

  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Test database name must end with _test, got: ${dbName}\n` +
      `Expected: cm_task_manager_test\n` +
      `Actual: ${dbName}`
    );
  }

  await reseedDatabase();
});
