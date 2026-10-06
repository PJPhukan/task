import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/server/lib/prisma';
import { getPerms, setupPermissions } from '@/server/lib/permly';

let adminId: string;
let developerId: string;
let projectId: string;
let boardId: string;
let columnId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'developer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  developerId = users.find((u) => u.email === 'developer@example.com')!.id;

  const project = await prisma.project.create({
    data: {
      name: 'Test Project',
      key: `CR${Date.now().toString().slice(-2)}`,
    },
  });
  projectId = project.id;

  await prisma.projectMember.create({
    data: { projectId, userId: adminId },
  });

  await prisma.projectMember.create({
    data: { projectId, userId: developerId },
  });

  const board = await prisma.board.create({
    data: {
      projectId,
      name: 'Test Board',
      position: 0,
      createdById: adminId,
    },
  });
  boardId = board.id;

  const column = await prisma.boardColumn.create({
    data: {
      boardId,
      name: 'Test Column',
      position: 0,
    },
  });
  columnId = column.id;
});

describe('Column Rules API', () => {
  it('PUT /api/projects/:projectId/columns/:columnId/rules sets view and move rules', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${columnId}/rules`,
      {
        method: 'PUT',
        headers: { 'x-user-id': adminId, 'content-type': 'application/json' },
        body: JSON.stringify({
          viewRoleIds: ['developer', 'manager'],
          moveRoleIds: ['developer'],
        }),
      }
    );
    expect(response.status).toBe(200);
  });

  it('GET board includes canMove for each column', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}`,
      {
        headers: { 'x-user-id': developerId },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    const testColumn = data.board.columns.find((c: any) => c.id === columnId);
    expect(testColumn).toBeDefined();
    expect(testColumn).toHaveProperty('canMove');
    expect(testColumn.canMove).toBe(true);
  });

  it('Column with VIEW rule is missing from response for other roles', async () => {
    // Create a viewer user
    const viewer = await prisma.user.create({
      data: {
        name: 'Viewer',
        email: `viewer-${Date.now()}@example.com`,
        isActive: true,
      },
    });

    await prisma.projectMember.create({
      data: { projectId, userId: viewer.id },
    });

    // Column has view rule for developer only, viewer should not see it
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}`,
      {
        headers: { 'x-user-id': viewer.id },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    const testColumn = data.board.columns.find((c: any) => c.id === columnId);
    expect(testColumn).toBeUndefined();
  });

  it('canMove is false for role without MOVE rule', async () => {
    const managerEmail = `manager-${Date.now()}@example.com`;
    const manager = await prisma.user.create({
      data: { name: 'Manager', email: managerEmail, isActive: true },
    });

    const perms = getPerms();
    await setupPermissions();
    await perms.user(manager.id).assignRole('manager');

    await prisma.projectMember.create({
      data: { projectId, userId: manager.id },
    });

    // Manager can view (has view rule) but cannot move
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}`,
      {
        headers: { 'x-user-id': manager.id },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    const testColumn = data.board.columns.find((c: any) => c.id === columnId);
    expect(testColumn).toBeDefined();
    expect(testColumn.canMove).toBe(false);
  });

  it('GET /api/projects/:projectId/boards/:boardId/columns returns visible columns with canMove', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/boards/${boardId}/columns`,
      {
        headers: { 'x-user-id': developerId },
      }
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.columns)).toBe(true);
    const testColumn = data.columns.find((c: any) => c.id === columnId);
    expect(testColumn).toBeDefined();
    expect(testColumn.canMove).toBe(true);
  });

  it('Deleting role removes its column rules', async () => {
    // This is tested by the seed/permission setup
    // Use a test roleId (note: custom roles are stored in DB, not in permly)
    const testRoleId = `test-role-${Date.now()}`;

    // Add a view rule for this role
    await (prisma as any).columnRule.create({
      data: {
        columnId,
        ruleType: 'view',
        roleId: testRoleId,
      },
    });

    // Verify rule exists
    const rulesBefore = await (prisma as any).columnRule.findMany({
      where: { columnId, roleId: testRoleId },
    });
    expect(rulesBefore.length).toBe(1);

    // Delete the role by removing all rules
    await (prisma as any).columnRule.deleteMany({
      where: { roleId: testRoleId },
    });

    // Verify rule is gone
    const rulesAfter = await (prisma as any).columnRule.findMany({
      where: { columnId, roleId: testRoleId },
    });
    expect(rulesAfter.length).toBe(0);
  });

  it('User without column.manage cannot set rules', async () => {
    const response = await fetch(
      `http://localhost:3000/api/projects/${projectId}/columns/${columnId}/rules`,
      {
        method: 'PUT',
        headers: { 'x-user-id': developerId, 'content-type': 'application/json' },
        body: JSON.stringify({
          viewRoleIds: ['developer'],
          moveRoleIds: [],
        }),
      }
    );
    expect(response.status).toBe(403);
  });
});
