import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { syncPermissions } from '../src/server/permissions/sync';

loadEnv({ path: '.env.local' });
loadEnv();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: dbUrl });

(async () => {
  try {
    await syncPermissions(pool);
    console.log('✓ Permissions synchronized successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to sync permissions:', error);
    await pool.end();
    process.exit(1);
  }
})();
