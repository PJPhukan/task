import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getBoardsRoute } from '@/app/api/projects/[projectId]/boards/route';
import { PUT as updateBoardAccessRoute } from '@/app/api/projects/[projectId]/boards/[boardId]/access/route';
import { POST as addProjectMemberRoute } from '@/app/api/projects/[projectId]/members/route';
import { POST as createRoleRoute } from '@/app/api/roles/route';
import { POST as createUserRoute } from '@/app/api/users/route';
import { prisma } from '@/server/lib/prisma';
import { cleanupNonSeededUsers, reseedDatabase } from '@/__tests__/__helpers__/seed';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string;
let viewerId: string;
let projectId: string;
let boardId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;

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

  const board = await prisma.board.create({
    data: {
      projectId,
      name: 'Test Board',
      position: 0,
      createdById: adminId,
    },
  });
  boardId = board.id;
});

afterAll(async () => {
  await cleanupNonSeededUsers();
  await reseedDatabase();
});

describe('Board Access API', () => {
  it('PUT /api/projects/:projectId/boards/:boardId/access sets board to restricted', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`, { method: 'PUT', headers, body: JSON.stringify({ isOpen: false, allowedUserIds: [adminId], allowedRoleIds: [] }) });
    const response = await updateBoardAccessRoute(req, { params: Promise.resolve({ projectId, boardId }) });
    expect(response.status).toBe(200);
  });

  it('Restricted board is hidden from non-allowed members', async () => {
    // Add viewer as project member
    await prisma.projectMember.create({
      data: { projectId, userId: viewerId },
    });

    // Board list should not include the restricted board for viewer
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, { method: 'GET', headers });
    const response = await getBoardsRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    const hasRestrictedBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasRestrictedBoard).toBe(false);
  });

  it('Restricted board is visible to allowed user', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, { method: 'GET', headers });
    const response = await getBoardsRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });

  it('PUT /api/projects/:projectId/boards/:boardId/access sets board to open', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`, { method: 'PUT', headers, body: JSON.stringify({ isOpen: true, allowedUserIds: [], allowedRoleIds: [] }) });
    const response = await updateBoardAccessRoute(req, { params: Promise.resolve({ projectId, boardId }) });
    expect(response.status).toBe(200);

    // Now viewer should see it
    const listHeaders = new Headers();
    listHeaders.set('x-user-id', viewerId);
    const listReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, { method: 'GET', headers: listHeaders });
    const listResponse = await getBoardsRoute(listReq, { params: Promise.resolve({ projectId }) });
    expect(listResponse.status).toBe(200);
    const data = await listResponse.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });

  it('User without board.update cannot change board access', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`, { method: 'PUT', headers, body: JSON.stringify({ isOpen: false, allowedUserIds: [], allowedRoleIds: [] }) });
    const response = await updateBoardAccessRoute(req, { params: Promise.resolve({ projectId, boardId }) });
    expect(response.status).toBe(403);
  });

  it('POST /api/projects/:projectId/members with boardIds grants board access', async () => {
    const newUserEmail = `test-user-${Date.now()}@example.com`;
    const newUser = await prisma.user.create({
      data: { name: 'Test User', email: newUserEmail, isActive: true },
    });

    // Restrict the board
    const restrictHeaders = new Headers();
    restrictHeaders.set('x-user-id', adminId);
    restrictHeaders.set('content-type', 'application/json');
    const restrictReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`, { method: 'PUT', headers: restrictHeaders, body: JSON.stringify({ isOpen: false, allowedUserIds: [adminId], allowedRoleIds: [] }) });
    await updateBoardAccessRoute(restrictReq, { params: Promise.resolve({ projectId, boardId }) });

    // Add user to project with board access
    const addHeaders = new Headers();
    addHeaders.set('x-user-id', adminId);
    addHeaders.set('content-type', 'application/json');
    const addReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/members`, { method: 'POST', headers: addHeaders, body: JSON.stringify({ userId: newUser.id, boardIds: [boardId] }) });
    const response = await addProjectMemberRoute(addReq, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(201);

    // Now user should have access to the board
    const boardsHeaders = new Headers();
    boardsHeaders.set('x-user-id', newUser.id);
    const boardsReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, { method: 'GET', headers: boardsHeaders });
    const boardsResponse = await getBoardsRoute(boardsReq, { params: Promise.resolve({ projectId }) });
    expect(boardsResponse.status).toBe(200);
    const data = await boardsResponse.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });

  it('User with role on restricted board role list can access the board', async () => {
    const timestamp = Date.now();
    const customRoleName = `board-access-role-${timestamp}`;

    // Create a custom role
    const roleHeaders = new Headers();
    roleHeaders.set('x-user-id', adminId);
    roleHeaders.set('content-type', 'application/json');
    const roleReq = new NextRequest('http://localhost:3000/api/roles', { method: 'POST', headers: roleHeaders, body: JSON.stringify({ name: customRoleName, permissionKeys: ['task.create'] }) });
    const createRoleRes = await createRoleRoute(roleReq);
    expect(createRoleRes.status).toBe(201);

    // Create a new user with the custom role
    const userHeaders = new Headers();
    userHeaders.set('x-user-id', adminId);
    userHeaders.set('content-type', 'application/json');
    const userReq = new NextRequest('http://localhost:3000/api/users', { method: 'POST', headers: userHeaders, body: JSON.stringify({ name: `Board User ${timestamp}`, email: `board-user-${timestamp}@example.com`, roleIds: [customRoleName] }) });
    const createUserRes = await createUserRoute(userReq);
    expect(createUserRes.status).toBe(201);
    const newUser = (await createUserRes.json()).user;

    // Add user to project
    const addMemberHeaders = new Headers();
    addMemberHeaders.set('x-user-id', adminId);
    addMemberHeaders.set('content-type', 'application/json');
    const addMemberReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/members`, { method: 'POST', headers: addMemberHeaders, body: JSON.stringify({ userId: newUser.id }) });
    await addProjectMemberRoute(addMemberReq, { params: Promise.resolve({ projectId }) });

    // Restrict the board and add the custom role to allowed list
    const restrictHeaders = new Headers();
    restrictHeaders.set('x-user-id', adminId);
    restrictHeaders.set('content-type', 'application/json');
    const restrictReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards/${boardId}/access`, { method: 'PUT', headers: restrictHeaders, body: JSON.stringify({ isOpen: false, allowedUserIds: [], allowedRoleIds: [customRoleName] }) });
    await updateBoardAccessRoute(restrictReq, { params: Promise.resolve({ projectId, boardId }) });

    // User with the custom role should see the board
    const boardsHeaders = new Headers();
    boardsHeaders.set('x-user-id', newUser.id);
    const boardsReq = new NextRequest(`http://localhost:3000/api/projects/${projectId}/boards`, { method: 'GET', headers: boardsHeaders });
    const boardsResponse = await getBoardsRoute(boardsReq, { params: Promise.resolve({ projectId }) });
    expect(boardsResponse.status).toBe(200);
    const data = await boardsResponse.json();
    const hasBoard = data.boards.some((b: any) => b.id === boardId);
    expect(hasBoard).toBe(true);
  });
});
