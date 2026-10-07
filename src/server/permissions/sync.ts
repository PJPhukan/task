import { createPermissions } from 'permly';
import { postgresAdapter } from 'permly/postgres';
import { Pool } from 'pg';
import { permissionCatalog } from './catalog';

export async function syncPermissions(pool: Pool) {
  const catalogKeys = Object.keys(permissionCatalog);

  const perms = createPermissions({
    adapter: postgresAdapter(pool, { schema: 'permly' }),
    permissions: catalogKeys,
    roles: ['admin', 'manager', 'member', 'viewer', 'developer', 'qa', 'deployment'],
  });

  await perms.sync();

  // Sync admin role to have exactly all catalog permissions
  await perms.role('admin').syncPermissions(catalogKeys as any);

  console.log(`✓ Permissions synced: ${catalogKeys.length} catalog keys`);
}
