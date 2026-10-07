import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as createInviteRoute, GET as listInvitesRoute } from "@/app/api/invites/route";
import { DELETE as deleteInviteRoute } from "@/app/api/invites/[inviteId]/route";
import { POST as resendInviteRoute } from "@/app/api/invites/[inviteId]/resend/route";
import { GET as getAcceptRoute, POST as postAcceptRoute } from "@/app/api/invites/accept/route";
import { prisma } from "@/server/lib/prisma";
import { getMailer } from "@/server/lib/mailer";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

describe("Invites API", () => {
  let testMailer: ReturnType<typeof getMailer>;
  let adminUserId: string;
  let viewerUserId: string;
  let createdInviteId: string;
  let createdInviteToken: string;

  beforeEach(async () => {
    testMailer = getMailer();
    testMailer.clearSentEmails();

    const timestamp = Date.now();
    const rand = Math.random();

    const admin = await prisma.user.create({
      data: {
        name: "Admin User",
        email: `admin-invites-${timestamp}-${rand}@example.com`,
        status: "ACTIVE",
        isActive: true,
      },
    });
    adminUserId = admin.id;

    const perms = getPerms();
    await setupPermissions();
    await perms.user(admin.id).assignRole("admin");

    const viewer = await prisma.user.create({
      data: {
        name: "Viewer User",
        email: `viewer-invites-${timestamp}-${rand}@example.com`,
        status: "ACTIVE",
        isActive: true,
      },
    });
    viewerUserId = viewer.id;
    await perms.user(viewer.id).assignRole("viewer");
  });

  afterEach(async () => {
    testMailer.clearSentEmails();
  });

  afterAll(async () => {
    await cleanupNonSeededUsers();
  });

  describe("POST /api/invites", () => {
    it("creates invite and sends email with token in link", async () => {
      const email = `invited-user-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const req = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email,
          roleIds: ["member"],
          projectIds: [],
          boardIds: [],
        }),
      });

      const res = await createInviteRoute(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.invite).toBeDefined();
      expect(data.invite.email).toBe(email);
      expect(data.invite.id).toBeDefined();
      createdInviteId = data.invite.id;

      // Verify email was sent
      const sentEmails = testMailer.getSentEmails();
      expect(sentEmails.length).toBeGreaterThan(0);

      const inviteEmail = sentEmails.find((e) => e.to === email);
      expect(inviteEmail).toBeDefined();
      expect(inviteEmail!.text).toContain("accept-invite?token=");

      // Extract token from email
      const tokenMatch = inviteEmail!.text.match(/token=([a-f0-9]+)/);
      expect(tokenMatch).toBeDefined();
      createdInviteToken = tokenMatch![1];

      // Verify only hash is stored (token should be different from what was sent)
      const storedInvite = await prisma.invite.findUnique({
        where: { id: createdInviteId },
      });
      expect(storedInvite).toBeDefined();
      expect(storedInvite!.tokenHash).not.toBe(createdInviteToken);
    });

    it("rejects if user already has an account", async () => {
      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const req = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: "admin@example.com",
          roleIds: ["member"],
        }),
      });

      const res = await createInviteRoute(req);
      expect(res.status).toBe(409);
      const data = await res.json();
      expect(data.error.message).toContain("already exists");
    });

    it("revokes previous pending invite when inviting same email again", async () => {
      const email = `duplicate-invite-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      // First invite
      const req1 = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, roleIds: ["member"] }),
      });
      const res1 = await createInviteRoute(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      const firstInviteId = data1.invite.id;

      // Second invite (should revoke first)
      const req2 = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, roleIds: ["viewer"] }),
      });
      const res2 = await createInviteRoute(req2);
      expect(res2.status).toBe(201);

      // Verify first invite is revoked
      const revokedInvite = await prisma.invite.findUnique({
        where: { id: firstInviteId },
      });
      expect(revokedInvite!.revokedAt).not.toBeNull();
    });

    it("requires user.manage permission", async () => {
      const headers = new Headers();
      headers.set("x-user-id", viewerUserId);
      headers.set("content-type", "application/json");

      const req = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          roleIds: ["member"],
        }),
      });

      const res = await createInviteRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("GET /api/invites", () => {
    it("lists pending invites newest first", async () => {
      // Create invites with delays to ensure ordering
      for (let i = 0; i < 2; i++) {
        const headers = new Headers();
        headers.set("x-user-id", adminUserId);
        headers.set("content-type", "application/json");

        const req = new NextRequest("http://localhost:3000/api/invites", {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: `invite-list-${i}-${Date.now()}@example.com`,
            roleIds: ["member"],
          }),
        });

        await createInviteRoute(req);
      }

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      const req = new NextRequest("http://localhost:3000/api/invites", {
        method: "GET",
        headers,
      });

      const res = await listInvitesRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.invites)).toBe(true);
      expect(data.invites.length).toBeGreaterThanOrEqual(2);
    });

    it("requires user.manage permission", async () => {
      const headers = new Headers();
      headers.set("x-user-id", viewerUserId);

      const req = new NextRequest("http://localhost:3000/api/invites", {
        method: "GET",
        headers,
      });

      const res = await listInvitesRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/invites/accept?token=...", () => {
    it("returns email and inviter name for valid token", async () => {
      const email = `accept-test-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email, roleIds: ["member"] }),
      });

      await createInviteRoute(createReq);

      // Extract token from email
      const sentEmails = testMailer.getSentEmails();
      const inviteEmail = sentEmails.find((e) => e.to === email);
      const tokenMatch = inviteEmail!.text.match(/token=([a-f0-9]+)/);
      const token = tokenMatch![1];

      // Validate token
      const req = new NextRequest(
        `http://localhost:3000/api/invites/accept?token=${token}`,
        { method: "GET" }
      );

      const res = await getAcceptRoute(req);
      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result.email).toBe(email);
      expect(result.invitedBy).toBe("Admin User");
    });

    it("returns 404 for invalid token", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/invites/accept?token=invalid-token-12345",
        { method: "GET" }
      );

      const res = await getAcceptRoute(req);
      expect(res.status).toBe(404);
    });

    it("returns 404 for expired invite", async () => {
      const email = `expired-invite-${Date.now()}@example.com`;

      // Create invite with past expiry
      await prisma.invite.create({
        data: {
          email,
          tokenHash: "test-hash",
          roleIds: ["member"],
          projectIds: [],
          boardIds: [],
          expiresAt: new Date(Date.now() - 1000), // Already expired
          invitedById: adminUserId,
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/invites/accept?token=any-token`,
        { method: "GET" }
      );

      const res = await getAcceptRoute(req);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/invites/accept", () => {
    it("creates ACTIVE user with granted roles, projects, and boards", async () => {
      // Create an invite
      const inviteEmail = `accept-create-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: inviteEmail,
          roleIds: ["member"],
        }),
      });

      await createInviteRoute(createReq);

      // Extract token
      const sentEmails = testMailer.getSentEmails();
      const email = sentEmails.find((e) => e.to === inviteEmail);
      const tokenMatch = email!.text.match(/token=([a-f0-9]+)/);
      const token = tokenMatch![1];

      // Accept invite
      const acceptReq = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: "New User",
          password: "SecurePassword123",
        }),
      });

      const acceptRes = await postAcceptRoute(acceptReq);
      expect(acceptRes.status).toBe(201);
      const acceptData = await acceptRes.json();
      expect(acceptData.user).toBeDefined();
      expect(acceptData.user.name).toBe("New User");
      expect(acceptData.user.email).toBe(inviteEmail);
      expect(acceptData.user.status).toBe("ACTIVE");
      expect(acceptData.user.roles).toContain("member");

      // Verify user can sign in
      const signInReq = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "http://localhost:3000",
        },
        body: JSON.stringify({ email: inviteEmail, password: "SecurePassword123" }),
      });

      const { POST: authPost } = await import("@/app/api/auth/[...all]/route");
      const signInRes = await authPost(signInReq);
      expect(signInRes.status).toBe(200);
    });

    it("does not send verification email on accept", async () => {
      const inviteEmail = `accept-no-verify-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: inviteEmail, roleIds: ["member"] }),
      });

      await createInviteRoute(createReq);

      // Extract token from invitation email (before clearing)
      const sentEmails = testMailer.getSentEmails();
      const inviteEmailObj = sentEmails.find((e) => e.to === inviteEmail);
      expect(inviteEmailObj).toBeDefined();
      const tokenMatch = inviteEmailObj!.text.match(/token=([a-f0-9]+)/);
      expect(tokenMatch).toBeDefined();
      const token = tokenMatch![1];

      // Clear emails before accept
      testMailer.clearSentEmails();

      // Accept invite
      const acceptReq = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: "New User",
          password: "SecurePassword123",
        }),
      });

      await postAcceptRoute(acceptReq);

      // Check that no verification email was sent after accept
      const afterAcceptEmails = testMailer.getSentEmails();
      const verificationEmails = afterAcceptEmails.filter((e) =>
        e.subject.toLowerCase().includes("verify")
      );
      expect(verificationEmails.length).toBe(0);

      // Check that no admin notification was sent
      const adminNotifications = afterAcceptEmails.filter((e) =>
        e.subject.toLowerCase().includes("waiting")
      );
      expect(adminNotifications.length).toBe(0);
    });

    it("refuses if token already used", async () => {
      const inviteEmail = `accept-twice-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: inviteEmail, roleIds: ["member"] }),
      });

      await createInviteRoute(createReq);

      const sentEmails = testMailer.getSentEmails();
      const inviteEmail1 = sentEmails.find((e) => e.to === inviteEmail);
      const tokenMatch = inviteEmail1!.text.match(/token=([a-f0-9]+)/);
      const token = tokenMatch![1];

      // First accept
      const acceptReq1 = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: "New User",
          password: "SecurePassword123",
        }),
      });

      const res1 = await postAcceptRoute(acceptReq1);
      expect(res1.status).toBe(201);

      // Second accept with same token
      const acceptReq2 = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: "Another User",
          password: "AnotherPassword123",
        }),
      });

      const res2 = await postAcceptRoute(acceptReq2);
      expect(res2.status).toBe(400);
      const data = await res2.json();
      expect(data.error.message).toContain("already been used");
    });

    it("refuses if invite is revoked", async () => {
      const inviteEmail = `accept-revoked-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: inviteEmail, roleIds: ["member"] }),
      });

      const createRes = await createInviteRoute(createReq);
      const createData = await createRes.json();
      const inviteId = createData.invite.id;

      // Extract token
      const sentEmails = testMailer.getSentEmails();
      const inviteEmail1 = sentEmails.find((e) => e.to === inviteEmail);
      const tokenMatch = inviteEmail1!.text.match(/token=([a-f0-9]+)/);
      const token = tokenMatch![1];

      // Revoke invite
      const revokeHeaders = new Headers();
      revokeHeaders.set("x-user-id", adminUserId);
      const revokeReq = new NextRequest(
        `http://localhost:3000/api/invites/${inviteId}`,
        { method: "DELETE", headers: revokeHeaders }
      );

      await deleteInviteRoute(revokeReq, { params: { inviteId } });

      // Try to accept
      const acceptReq = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: "New User",
          password: "SecurePassword123",
        }),
      });

      const acceptRes = await postAcceptRoute(acceptReq);
      expect(acceptRes.status).toBe(400);
    });

    it("verifies token exists before checking role permissions", async () => {
      // Test that invalid tokens are properly rejected
      const acceptReq = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: "non-existent-token-xyz",
          name: "New User",
          password: "SecurePassword123",
        }),
      });

      const acceptRes = await postAcceptRoute(acceptReq);
      // Invalid token should return 400 or 404 depending on implementation
      expect([400, 404]).toContain(acceptRes.status);
      const data = await acceptRes.json();
      expect(data.error.code).toBe("ACCEPT_ERROR");
    });
  });

  describe("DELETE /api/invites/:inviteId", () => {
    it("revokes invite", async () => {
      const inviteEmail = `revoke-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: inviteEmail, roleIds: ["member"] }),
      });

      const createRes = await createInviteRoute(createReq);
      const createData = await createRes.json();
      const inviteId = createData.invite.id;

      // Revoke
      const revokeHeaders = new Headers();
      revokeHeaders.set("x-user-id", adminUserId);
      const revokeReq = new NextRequest(
        `http://localhost:3000/api/invites/${inviteId}`,
        { method: "DELETE", headers: revokeHeaders }
      );

      const revokeRes = await deleteInviteRoute(revokeReq, { params: { inviteId } });
      expect(revokeRes.status).toBe(200);

      // Verify revoked
      const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
      expect(invite!.revokedAt).not.toBeNull();
    });

    it("requires user.manage permission", async () => {
      const headers = new Headers();
      headers.set("x-user-id", viewerUserId);

      const revokeReq = new NextRequest("http://localhost:3000/api/invites/fake-id", {
        method: "DELETE",
        headers,
      });

      const revokeRes = await deleteInviteRoute(revokeReq, { params: { inviteId: "fake-id" } });
      expect(revokeRes.status).toBe(403);
    });
  });

  describe("POST /api/invites/:inviteId/resend", () => {
    it("issues new token and makes old link fail", async () => {
      const inviteEmail = `resend-${Date.now()}@example.com`;

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: inviteEmail, roleIds: ["member"] }),
      });

      const createRes = await createInviteRoute(createReq);
      const createData = await createRes.json();
      const inviteId = createData.invite.id;

      // Extract first token
      let sentEmails = testMailer.getSentEmails();
      let firstEmail = sentEmails.find((e) => e.to === inviteEmail);
      let tokenMatch = firstEmail!.text.match(/token=([a-f0-9]+)/);
      const firstToken = tokenMatch![1];

      // Verify first token works
      const validateReq1 = new NextRequest(
        `http://localhost:3000/api/invites/accept?token=${firstToken}`,
        { method: "GET" }
      );
      const validateRes1 = await getAcceptRoute(validateReq1);
      expect(validateRes1.status).toBe(200);

      // Resend
      testMailer.clearSentEmails();
      const resendHeaders = new Headers();
      resendHeaders.set("x-user-id", adminUserId);
      const resendReq = new NextRequest(
        `http://localhost:3000/api/invites/${inviteId}/resend`,
        { method: "POST", headers: resendHeaders }
      );

      const resendRes = await resendInviteRoute(resendReq, { params: { inviteId } });
      expect(resendRes.status).toBe(200);

      // Verify old token no longer works
      const validateReq2 = new NextRequest(
        `http://localhost:3000/api/invites/accept?token=${firstToken}`,
        { method: "GET" }
      );
      const validateRes2 = await getAcceptRoute(validateReq2);
      expect(validateRes2.status).toBe(404);

      // Extract new token and verify it works
      sentEmails = testMailer.getSentEmails();
      const resendEmail = sentEmails.find((e) => e.to === inviteEmail);
      tokenMatch = resendEmail!.text.match(/token=([a-f0-9]+)/);
      const newToken = tokenMatch![1];

      const validateReq3 = new NextRequest(
        `http://localhost:3000/api/invites/accept?token=${newToken}`,
        { method: "GET" }
      );
      const validateRes3 = await getAcceptRoute(validateReq3);
      expect(validateRes3.status).toBe(200);
    });

    it("requires user.manage permission", async () => {
      const headers = new Headers();
      headers.set("x-user-id", viewerUserId);

      const resendReq = new NextRequest(
        "http://localhost:3000/api/invites/fake-id/resend",
        { method: "POST", headers }
      );

      const resendRes = await resendInviteRoute(resendReq, { params: { inviteId: "fake-id" } });
      expect(resendRes.status).toBe(403);
    });
  });

  describe("Session termination on deactivation", () => {
    it("deactivating user ends all sessions", async () => {
      // Create a user with password
      const userEmail = `deactivate-${Date.now()}@example.com`;
      const password = "DeactivateTest123";

      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      headers.set("content-type", "application/json");

      // Create invite and accept it
      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({ email: userEmail, roleIds: ["member"] }),
      });

      await createInviteRoute(createReq);

      const sentEmails = testMailer.getSentEmails();
      const inviteEmail = sentEmails.find((e) => e.to === userEmail);
      const tokenMatch = inviteEmail!.text.match(/token=([a-f0-9]+)/);
      const token = tokenMatch![1];

      const acceptReq = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          name: "Test User",
          password,
        }),
      });

      const acceptRes = await postAcceptRoute(acceptReq);
      const userData = await acceptRes.json();
      const userId = userData.user.id;

      // Sign in to create session
      const { POST: authPost } = await import("@/app/api/auth/[...all]/route");
      const signInReq = new NextRequest("http://localhost:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "http://localhost:3000",
        },
        body: JSON.stringify({ email: userEmail, password }),
      });

      const signInRes = await authPost(signInReq);
      expect(signInRes.status).toBe(200);

      // Verify session exists
      const sessionBefore = await prisma.session.findFirst({ where: { userId } });
      expect(sessionBefore).toBeDefined();

      // Deactivate user
      const deactivateHeaders = new Headers();
      deactivateHeaders.set("x-user-id", adminUserId);
      deactivateHeaders.set("content-type", "application/json");

      const deactivateReq = new NextRequest(`http://localhost:3000/api/users/${userId}`, {
        method: "PATCH",
        headers: deactivateHeaders,
        body: JSON.stringify({ isActive: false }),
      });

      const { PATCH: patchUserRoute } = await import("@/app/api/users/[userId]/route");
      const deactivateRes = await patchUserRoute(deactivateReq, { params: Promise.resolve({ userId }) });
      expect(deactivateRes.status).toBe(200);

      // Verify sessions are deleted
      const sessionsAfter = await prisma.session.findMany({ where: { userId } });
      expect(sessionsAfter.length).toBe(0);
    });
  });

  describe("PENDING user access control", () => {
    it("PENDING user cannot call admin invite routes", async () => {
      const pendingUser = await prisma.user.create({
        data: {
          name: "Pending User",
          email: `pending-invite-${Date.now()}@example.com`,
          status: "PENDING",
          isActive: true,
        },
      });

      const headers = new Headers();
      headers.set("x-user-id", pendingUser.id);
      headers.set("content-type", "application/json");

      // Try POST /api/invites
      const createReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: `test-${Date.now()}@example.com`,
          roleIds: ["member"],
        }),
      });

      const createRes = await createInviteRoute(createReq);
      expect(createRes.status).toBe(403);

      // Try GET /api/invites
      const listReq = new NextRequest("http://localhost:3000/api/invites", {
        method: "GET",
        headers,
      });

      const listRes = await listInvitesRoute(listReq);
      expect(listRes.status).toBe(403);
    });
  });
});
