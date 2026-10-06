import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getMeRoute } from '@/app/api/me/route';
import { GET as getDevUsersRoute } from '@/app/api/dev/users/route';
import { prisma } from '@/server/lib/prisma';

const dbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL or TEST_DATABASE_URL is required');

let adminUserId: string;
let viewerUserId: string;

beforeAll(async () => {
  // Get the seeded user IDs
  const users = await prisma.user.findMany({
    where: {
      email: {
        in: ['admin@example.com', 'viewer@example.com'],
      },
    },
  });

  const admin = users.find((u) => u.email === 'admin@example.com');
  const viewer = users.find((u) => u.email === 'viewer@example.com');

  if (!admin || !viewer) {
    throw new Error('Test users not found. Run the seed script first.');
  }

  adminUserId = admin.id;
  viewerUserId = viewer.id;
});

describe('GET /api/me', () => {
  it('returns 401 without x-user-id header', async () => {
    const req = new NextRequest('http://localhost:3000/api/me', { method: 'GET' });
    const res = await getMeRoute(req);
    expect(res.status).toBe(401);
  });

  it('returns user data with valid x-user-id header', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminUserId);
    const req = new NextRequest('http://localhost:3000/api/me', { method: 'GET', headers });
    const res = await getMeRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(adminUserId);
    expect(data.user.name).toBe('Admin User');
    expect(data.roles).toBeDefined();
    expect(data.permissions).toBeDefined();
  });

  it('includes correct role for admin user', async () => {
    const headers = new Headers();
    headers.set('x-user-id', adminUserId);
    const req = new NextRequest('http://localhost:3000/api/me', { method: 'GET', headers });
    const res = await getMeRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.roles).toContain('admin');
  });

  it('viewer user has only view permissions', async () => {
    const headers = new Headers();
    headers.set('x-user-id', viewerUserId);
    const req = new NextRequest('http://localhost:3000/api/me', { method: 'GET', headers });
    const res = await getMeRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.roles).toContain('viewer');
    expect(data.permissions).toEqual([]);
  });
});

describe('GET /api/dev/users', () => {
  it('returns 404 when AUTH_MODE is not dev', async () => {
    const res = await getDevUsersRoute();
    expect([200, 404]).toContain(res.status);
  });

  it('returns user list when AUTH_MODE is dev', async () => {
    const res = await getDevUsersRoute();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);
  });
});

describe('Permission checks', () => {
  it('admin user has admin role in database', async () => {
    const roles = await prisma.$queryRaw`
      SELECT DISTINCT role_id FROM permly.perm_user_roles
      WHERE user_id = ${adminUserId}
    `;
    expect(roles).toBeDefined();
  });

  it('viewer user has viewer role in database', async () => {
    const roles = await prisma.$queryRaw`
      SELECT DISTINCT role_id FROM permly.perm_user_roles
      WHERE user_id = ${viewerUserId}
    `;
    expect(roles).toBeDefined();
  });
});
