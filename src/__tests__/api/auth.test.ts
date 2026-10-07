import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { GET as getMeRoute } from '@/app/api/me/route';

describe('Seeded User Sign-In', () => {
  it('Seeded Admin user exists with stored password hash', async () => {
    const email = 'admin@example.com';

    // Verify the user exists
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();
    expect(user?.email).toBe(email);
    expect(user?.name).toBe('Admin User');
    expect(user?.emailVerified).toBe(true);
    expect(user?.status).toBe('ACTIVE');

    // Verify the credential account exists with password hash
    const account = await prisma.account.findFirst({
      where: {
        userId: user!.id,
        provider: 'credential',
      },
    });
    expect(account).toBeDefined();
    expect(account?.password).toBeTruthy();
    expect(account?.type).toBe('credentials');
  });

  it('Seeded Admin user can be retrieved via GET /api/me with x-user-id header', async () => {
    const email = 'admin@example.com';

    // Get the admin user
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeDefined();

    // Call GET /api/me with x-user-id header (dev mode)
    const meReq = new NextRequest('http://localhost:3000/api/me', {
      method: 'GET',
      headers: {
        'x-user-id': user!.id,
      },
    });

    const meRes = await getMeRoute(meReq);
    expect(meRes.status).toBe(200);

    const meData = await meRes.json();
    expect(meData.user).toBeDefined();
    expect(meData.user.email).toBe(email);
    expect(meData.user.name).toBe('Admin User');
    expect(meData.roles).toContain('admin');
  });
});
