import "server-only";
import { Pool } from "pg";
import { createPermissions } from "permly";
import { postgresAdapter } from "permly/postgres";
import { getEnv } from "../config/env";

const permissions = [
  // Project permissions
  "project.create",
  "project.delete",
  "project.update",
  // Board permissions
  "board.create",
  "board.update",
  "board.delete",
  // Column permissions
  "column.manage",
  // Task permissions
  "task.create",
  "task.update",
  "task.move",
  "task.delete",
  // Comment permissions
  "comment.create",
  "comment.update",
  "comment.delete",
  // Attachment permissions
  "attachment.upload",
  "attachment.delete",
  // Label permissions
  "label.manage",
  // Member permissions
  "member.manage",
] as const;

const roles = ["admin", "manager", "member", "viewer"] as const;

let permsInstance: ReturnType<typeof createPermissions> | null = null;

function createPermlyInstance() {
  const env = getEnv();
  const dbUrl = env.TEST_DATABASE_URL || env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL or TEST_DATABASE_URL is required");
  }

  const pool = new Pool({
    connectionString: dbUrl,
  });

  return createPermissions({
    adapter: postgresAdapter(pool, { schema: "permly" }),
    permissions: [...permissions],
    roles: [...roles],
  });
}

export function getPerms() {
  if (!permsInstance) {
    permsInstance = createPermlyInstance();
  }
  return permsInstance;
}

export async function setupPermissions() {
  const perms = getPerms();
  const { createdRoles } = await perms.sync();

  if (createdRoles.length === 0) {
    return;
  }

  await perms.role("admin").givePermission("*");
  await perms.role("manager").givePermission(
    "project.update",
    "member.manage",
    "task.create",
    "task.update",
    "task.move",
    "task.delete",
    "comment.create",
    "comment.update",
    "comment.delete",
    "attachment.upload",
    "attachment.delete",
    "label.manage"
  );
  await perms.role("member").givePermission(
    "task.create",
    "task.update",
    "task.move",
    "comment.create",
    "attachment.upload"
  );
}

export type Permission = (typeof permissions)[number];
export type Role = (typeof roles)[number];
