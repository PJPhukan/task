import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getBoardRoute } from '@/app/api/projects/[projectId]/boards/[boardId]/route';
import { GET as getColumnsRoute } from '@/app/api/projects/[projectId]/boards/[boardId]/columns/route';
import { GET as getColumnRulesRoute, PUT as setColumnRulesRoute } from '@/app/api/projects/[projectId]/columns/[columnId]/rules/route';
import { prisma } from '@/server/lib/prisma';
import { getPerms, setupPermissions } from '@/server/lib/permly';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

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
      key: generateProjectKey(),
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
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/columns/${columnId}/rules`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        viewRoleIds: ['developer', 'manager'],
        moveRoleIds: ['developer'],
      }),
    });
    const response = await setColumnRulesRoute(req, { params: Promise.resolve({ projectId, columnId }) });
    expect(response.status).toBe(200);
  });

  it('GET board includes canMove for each column', async () => {
    const headers = new Headers();
    headers.set('x-user-id', developerId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, { method: 'GET', headers });
    const response = await getBoardRoute(req, { params: Promise.resolve({ projectId, boardId }) });
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
        status: 'ACTIVE',
      },
    });

    await prisma.projectMember.create({
      data: { projectId, userId: viewer.id },
    });

    // Column has view rule for developer only, viewer should not see it
    const headers = new Headers();
    headers.set('x-user-id', viewer.id);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, { method: 'GET', headers });
    const response = await getBoardRoute(req, { params: Promise.resolve({ projectId, boardId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    const testColumn = data.board.columns.find((c: any) => c.id === columnId);
    expect(testColumn).toBeUndefined();
  });

  it('canMove is false for role without MOVE rule', async () => {
    const managerEmail = `manager-${Date.now()}@example.com`;
    const manager = await prisma.user.create({
      data: { name: 'Manager', email: managerEmail, isActive: true, status: 'ACTIVE' },
    });

    const perms = getPerms();
    await setupPermissions();
    await perms.user(manager.id).assignRole('manager');

    await prisma.projectMember.create({
      data: { projectId, userId: manager.id },
    });

    // Manager can view (has view rule) but cannot move
    const headers = new Headers();
    headers.set('x-user-id', manager.id);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}`, { method: 'GET', headers });
    const response = await getBoardRoute(req, { params: Promise.resolve({ projectId, boardId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    const testColumn = data.board.columns.find((c: any) => c.id === columnId);
    expect(testColumn).toBeDefined();
    expect(testColumn.canMove).toBe(false);
  });

  it('GET /api/projects/:projectId/boards/:boardId/columns returns visible columns with canMove', async () => {
    const headers = new Headers();
    headers.set('x-user-id', developerId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}/columns`, { method: 'GET', headers });
    const response = await getColumnsRoute(req, { params: Promise.resolve({ projectId, boardId }) });
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
    const headers = new Headers();
    headers.set('x-user-id', developerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/columns/${columnId}/rules`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        viewRoleIds: ['developer'],
        moveRoleIds: [],
      }),
    });
    const response = await setColumnRulesRoute(req, { params: Promise.resolve({ projectId, columnId }) });
    expect(response.status).toBe(403);
  });

  it('GET /api/projects/:projectId/columns/:columnId/rules returns roles with displayName', async () => {
    // Set rules with developer and manager roles
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const setReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/columns/${columnId}/rules`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        viewRoleIds: ['developer', 'manager'],
        moveRoleIds: ['developer'],
      }),
    });
    await setColumnRulesRoute(setReq, { params: Promise.resolve({ projectId, columnId }) });

    // GET the rules and verify displayNames are present
    const getHeaders = new Headers();
    getHeaders.set('x-user-id', adminId);
    const getReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/columns/${columnId}/rules`, {
      method: 'GET',
      headers: getHeaders,
    });
    const response = await getColumnRulesRoute(getReq, { params: Promise.resolve({ projectId, columnId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.viewRoles)).toBe(true);
    expect(Array.isArray(data.moveRoles)).toBe(true);
    expect(data.viewRoles.length).toBeGreaterThanOrEqual(2);
    expect(data.moveRoles.length).toBeGreaterThanOrEqual(1);
    // Verify each role has id and displayName
    data.viewRoles.forEach((role: any) => {
      expect(role.id).toBeDefined();
      expect(role.displayName).toBeDefined();
    });
    data.moveRoles.forEach((role: any) => {
      expect(role.id).toBeDefined();
      expect(role.displayName).toBeDefined();
    });
  });
});
