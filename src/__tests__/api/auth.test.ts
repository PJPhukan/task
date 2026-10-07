import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { GET as getMeRoute } from '@/app/api/me/route';
import { POST as authPost } from '@/app/api/auth/[...all]/route';
import { GET as authGet } from '@/app/api/auth/[...all]/route';
import { auth } from '@/server/auth/better-auth';
import { getMailer } from '@/server/lib/mailer';

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

  it('User can sign up, verify email, and then sign in with correct password', async () => {
    const email = `test-signin-${Date.now()}@example.com`;
    const password = 'TestPassword123!';
    const mailer = getMailer();

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

    // Get verification email
    const sentEmails = mailer.getSentEmails();
    expect(sentEmails.length).toBeGreaterThan(0);
    const verificationEmail = sentEmails.find(e => e.to === email);
    expect(verificationEmail).toBeDefined();

    // Extract verification token from email
    const tokenMatch = verificationEmail!.text.match(/token=([^&]+)/);
    expect(tokenMatch).toBeDefined();
    const token = tokenMatch![1];

    // Verify email by calling the verify endpoint
    const verifyReq = new NextRequest(`http://localhost:3000/api/auth/verify-email?token=${token}&callbackURL=/`, {
      method: 'GET',
    });
    const verifyRes = await authGet(verifyReq);
    expect(verifyRes.status).toBe(302); // Redirect after verification

    // Now sign in with the created credentials (should work after verification)
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
    const mailer = getMailer();

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

    // Verify email first
    const sentEmails = mailer.getSentEmails();
    const verificationEmail = sentEmails.find(e => e.to === email);
    const tokenMatch = verificationEmail!.text.match(/token=([^&]+)/);
    const token = tokenMatch![1];

    const verifyReq = new NextRequest(`http://localhost:3000/api/auth/verify-email?token=${token}&callbackURL=/`, {
      method: 'GET',
    });
    await authGet(verifyReq);

    // Try to sign in with wrong password (should fail even after verification)
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

  it('PENDING user can call GET /api/me with limited info', async () => {
    const email = `pending-test-${Date.now()}@example.com`;

    // Create a user with PENDING status and verified email
    const user = await prisma.user.create({
      data: {
        name: 'Pending Test User',
        email,
        emailVerified: true,
        status: 'PENDING',
        isActive: true,
      },
    });

    // Call GET /api/me with x-user-id header (dev mode) - should return 200 with limited info
    const meReq = new NextRequest('http://localhost:3000/api/me', {
      method: 'GET',
      headers: {
        'x-user-id': user.id,
      },
    });

    const meRes = await getMeRoute(meReq);
    expect(meRes.status).toBe(200);

    const meData = await meRes.json();
    expect(meData.user).toBeDefined();
    expect(meData.user.id).toBe(user.id);
    expect(meData.user.email).toBe(email);
    expect(meData.user.status).toBe('PENDING');
    expect(meData.user.name).toBeUndefined();
    expect(meData.roles).toBeUndefined();
  });

  it('PENDING user gets 403 ACCOUNT_PENDING on project route', async () => {
    const email = `pending-project-${Date.now()}@example.com`;

    // Create a PENDING user
    const user = await prisma.user.create({
      data: {
        name: 'Pending User',
        email,
        emailVerified: true,
        status: 'PENDING',
        isActive: true,
      },
    });

    // Try to access /api/projects - should get 403 ACCOUNT_PENDING
    const { GET: getProjects } = await import('@/app/api/projects/route');
    const projectsReq = new NextRequest('http://localhost:3000/api/projects', {
      method: 'GET',
      headers: {
        'x-user-id': user.id,
      },
    });

    const projectsRes = await getProjects(projectsReq);
    expect(projectsRes.status).toBe(403);

    const projectsData = await projectsRes.json();
    expect(projectsData.error.code).toBe('ACCOUNT_PENDING');
  });

  it('Password reset works end-to-end with mailer link and seeded admin', async () => {
    const email = 'admin@example.com';
    const password = 'development123';
    const newPassword = 'NewPassword456!';
    const mailer = getMailer();

    // Clear previous emails
    mailer.getSentEmails();

    // Request password reset for seeded admin
    const forgotReq = new NextRequest('http://localhost:3000/api/auth/request-password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email }),
    });

    const forgotRes = await authPost(forgotReq);
    expect(forgotRes.status).toBe(200);

    // Get reset token from email
    const resetEmails = mailer.getSentEmails();
    const resetEmail = resetEmails.find(e => e.to === email);
    expect(resetEmail).toBeDefined();

    // Token is in the URL path: /reset-password/TOKEN?callbackURL=
    const resetTokenMatch = resetEmail!.text.match(/reset-password\/([^?&\s]+)/);
    expect(resetTokenMatch).toBeDefined();
    const resetToken = resetTokenMatch![1];

    // Reset password
    const resetReq = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ token: resetToken, newPassword }),
    });

    const resetRes = await authPost(resetReq);
    expect(resetRes.status).toBe(200);

    // Try to sign in with old password - should fail
    const oldSignInReq = new NextRequest('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password }),
    });

    const oldSignInRes = await authPost(oldSignInReq);
    expect(oldSignInRes.status).not.toBe(200);

    // Sign in with new password - should succeed
    const newSignInReq = new NextRequest('http://localhost:3000/api/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:3000',
      },
      body: JSON.stringify({ email, password: newPassword }),
    });

    const newSignInRes = await authPost(newSignInReq);
    expect(newSignInRes.status).toBe(200);
  });

  it('x-user-id with non-existent user ID is rejected with 401', async () => {
    // Attempt to use a non-existent user ID
    const fakeUserId = 'nonexistent-user-' + Date.now();

    const { GET: getProjects } = await import('@/app/api/projects/route');
    const projectsReq = new NextRequest('http://localhost:3000/api/projects', {
      method: 'GET',
      headers: {
        'x-user-id': fakeUserId,
      },
    });

    const projectsRes = await getProjects(projectsReq);
    expect(projectsRes.status).toBe(401);

    const projectsData = await projectsRes.json();
    expect(projectsData.error.code).toBe('UNAUTHORIZED');
  });
});
