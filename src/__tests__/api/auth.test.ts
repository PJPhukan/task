import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { GET as getMeRoute } from '@/app/api/me/route';
import { POST as authPost } from '@/app/api/auth/[...all]/route';
import { auth } from '@/server/auth/better-auth';

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
        providerId: 'credential',
      },
    });
    expect(account).toBeDefined();
    expect(account?.password).toBeTruthy();
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

  it('Seeded Admin can sign in and access /api/me with session cookie', async () => {
    const email = 'admin@example.com';
    const password = 'development123';

    // Sign in with seeded admin credentials
    const signInReq = new NextRequest('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password }),
    });

    const signInRes = await authPost(signInReq);
    expect(signInRes.status).toBe(200);

    // Extract session cookie
    const setCookieHeader = signInRes.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain('session');

    const cookies = setCookieHeader!.split(';')[0];

    // Call GET /api/me with session cookie (simulating session mode)
    const meReq = new NextRequest('http://localhost:3000/api/me', {
      method: 'GET',
      headers: {
        'Cookie': cookies,
      },
    });

    const meRes = await getMeRoute(meReq);
    expect(meRes.status).toBe(200);

    const meData = await meRes.json();
    expect(meData.user).toBeDefined();
    expect(meData.user.email).toBe(email);
    expect(meData.user.name).toBe('Admin User');
  });

  it('User can sign up and then sign in with correct password', async () => {
    const email = `test-signin-${Date.now()}@example.com`;
    const password = 'TestPassword123!';

    // First, sign up to create user through Better Auth
    const signUpReq = new NextRequest('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password, name: 'Test User' }),
    });

    const signUpRes = await authPost(signUpReq);
    expect(signUpRes.status).toBe(200);

    // Now sign in with the created credentials
    const signInReq = new NextRequest('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password }),
    });

    const signInRes = await authPost(signInReq);
    expect(signInRes.status).toBe(200);

    const signInData = await signInRes.json();
    expect(signInData.token).toBeDefined();

    // Check for session cookie
    const setCookieHeader = signInRes.headers.get('set-cookie');
    expect(setCookieHeader).toBeDefined();
    expect(setCookieHeader).toContain('session');

    // Parse cookie from response
    const cookies = setCookieHeader!.split(';')[0];

    // Verify session exists in database
    let cookieToken = cookies.split('=')[1];
    cookieToken = decodeURIComponent(cookieToken);
    const sessionId = cookieToken.split('.')[0];

    const createdSession = await prisma.session.findUnique({
      where: { token: sessionId },
      include: { user: true },
    });
    expect(createdSession).toBeDefined();
    expect(createdSession?.user.email).toBe(email);

    // Verify session can be retrieved via Better Auth's API
    const headers = new Headers();
    headers.set('Cookie', cookies);

    const sessionFromAuth = await auth.api.getSession({ headers });
    expect(sessionFromAuth).toBeDefined();
    expect(sessionFromAuth?.user).toBeDefined();
    expect(sessionFromAuth?.user.email).toBe(email);
  });

  it('Sign in fails with wrong password', async () => {
    const email = `fail-login-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const wrongPassword = 'WrongPassword123!';

    // Sign up first
    const signUpReq = new NextRequest('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password, name: 'Test User' }),
    });

    const signUpRes = await authPost(signUpReq);
    expect(signUpRes.status).toBe(200);

    // Try to sign in with wrong password
    const signInReq = new NextRequest('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password: wrongPassword }),
    });

    const signInRes = await authPost(signInReq);
    expect(signInRes.status).not.toBe(200);
  });
});
