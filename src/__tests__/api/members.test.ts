import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMembersRoute, POST as addMemberRoute } from '@/app/api/projects/[projectId]/members/route';
import { DELETE as removeMemberRoute } from '@/app/api/projects/[projectId]/members/[userId]/route';
import { GET as getUsersRoute } from '@/app/api/users/route';
import { prisma } from '@/server/lib/prisma';

function generateProjectKey(length = 4): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

let adminId: string, memberId: string, viewerId: string, newUserId: string, projectId: string;

beforeAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: ['admin@example.com', 'member@example.com', 'viewer@example.com'] } },
  });
  adminId = users.find((u) => u.email === 'admin@example.com')!.id;
  memberId = users.find((u) => u.email === 'member@example.com')!.id;
  viewerId = users.find((u) => u.email === 'viewer@example.com')!.id;

  // Create a unique test user
  const timestamp = Date.now();
  const newUser = await prisma.user.create({
    data: { name: 'Test User', email: `test-${timestamp}@example.com` },
  });
  newUserId = newUser.id;

  const projectKey = generateProjectKey();
  const project = await prisma.project.create({
    data: { name: 'Members Test Project', key: projectKey },
  });
  projectId = project.id;
});

describe('Members API', () => {
  it('Member can list project members', async () => {
    await prisma.projectMember.create({
      data: { projectId, userId: memberId },
    });

    const headers = new Headers();
    headers.set('x-user-id', memberId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/members`, { method: 'GET', headers });
    const response = await getMembersRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.members)).toBe(true);
  });

  it('Non-member cannot list members', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/members`, { method: 'GET', headers });
    const response = await getMembersRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(403);
  });

  it('Admin can add member', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: viewerId }),
    });
    const response = await addMemberRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(201);
  });

  it('Viewer cannot add members', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    headers.set('content-type', 'application/json');
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: newUserId, role: 'member' }),
    });
    const response = await addMemberRoute(req, { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(403);
  });

  it('Admin can remove member', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest(`http://localhost:3000/api/projects/${projectId}/members/${viewerId}`, { method: 'DELETE', headers });
    const response = await removeMemberRoute(req, { params: Promise.resolve({ projectId, userId: viewerId }) });
    expect(response.status).toBe(200);
  });

  it('GET /api/users requires member.manage permission', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerId);
    const req = new NextRequest('http://localhost:3000/api/users', { method: 'GET', headers });
    const response = await getUsersRoute(req);
    expect(response.status).toBe(403);
  });

  it('Admin can get active users list', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminId);
    const req = new NextRequest('http://localhost:3000/api/users', { method: 'GET', headers });
    const response = await getUsersRoute(req);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.users)).toBe(true);
  });
});
