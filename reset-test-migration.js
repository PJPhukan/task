const { Pool } = require('pg');

const pool = new Pool({
  user: 'task_user',
  password: 'dev_password',
  host: 'localhost',
  port: 5433,
  database: 'cm_task_manager_test'
});

(async () => {
  try {
    // Delete the failed migration record
    const res = await pool.query('DELETE FROM "_prisma_migrations" WHERE migration_name = $1', ['20261007075315_fix_better_auth_schema']);
    console.log('Deleted failed migration record:', res.rowCount);
    
    // Get all migrations
    const all = await pool.query('SELECT id, migration_name FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 5');
    console.log('Remaining migrations (last 5):');
    all.rows.forEach(r => console.log('  -', r.migration_name));
    
    await pool.end();
    console.log('Done');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
