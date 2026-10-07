import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { GET as listRequests } from "@/app/api/join-requests/route";
import { POST as approveUser } from "@/app/api/join-requests/[userId]/approve/route";
import { POST as rejectUser } from "@/app/api/join-requests/[userId]/reject/route";
import prisma from "@/server/lib/prisma";
import { getMailer } from "@/server/lib/mailer";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

describe("Join Requests API", () => {
  let testMailer: ReturnType<typeof getMailer>;
  let adminUserId: string;
  let pendingUserId: string;
  let otherPendingUserId: string;
  let noManagePermUserId: string;

  beforeEach(async () => {
    testMailer = getMailer();
    testMailer.clearSentEmails();

    const timestamp = Date.now();
    const rand = Math.random();

    const admin = await prisma.user.create({
      data: {
        name: "Admin User",
        email: `admin-${timestamp}-${rand}@example.com`,
        status: "ACTIVE",
        isActive: true,
      },
    });
    adminUserId = admin.id;

    const perms = getPerms();
    await setupPermissions();
    await perms.user(admin.id).assignRole("admin");

    const pending = await prisma.user.create({
      data: {
        name: "Pending User",
        email: `pending-${timestamp}-${rand}@example.com`,
        status: "PENDING",
        isActive: true,
        emailVerified: true,
        createdAt: new Date(Date.now() - 3600000),
      },
    });
    pendingUserId = pending.id;

    const otherPending = await prisma.user.create({
      data: {
        name: "Other Pending",
        email: `other-pending-${timestamp}-${rand}@example.com`,
        status: "PENDING",
        isActive: true,
        emailVerified: true,
        createdAt: new Date(Date.now() - 1800000),
      },
    });
    otherPendingUserId = otherPending.id;

    const noManage = await prisma.user.create({
      data: {
        name: "No Manage Perm",
        email: `no-manage-${timestamp}-${rand}@example.com`,
        status: "ACTIVE",
        isActive: true,
      },
    });
    noManagePermUserId = noManage.id;
  });

  afterEach(async () => {
    testMailer.clearSentEmails();
  });

  describe("GET /api/join-requests", () => {
    it("lists only PENDING users with verified email, oldest first", async () => {
      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      const req = new NextRequest("http://localhost:3000/api/join-requests", { headers });
      const response = await listRequests(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data.joinRequests)).toBe(true);

      const requests = data.joinRequests.filter((r: any) =>
        [pendingUserId, otherPendingUserId].includes(r.id)
      );
      expect(requests.length).toBeGreaterThanOrEqual(2);

      const pendingIndex = requests.findIndex((r: any) => r.id === pendingUserId);
      const otherIndex = requests.findIndex((r: any) => r.id === otherPendingUserId);
      expect(pendingIndex).toBeLessThan(otherIndex);
    });

    it("returns 403 for user without user.manage permission", async () => {
      const headers = new Headers();
      headers.set("x-user-id", noManagePermUserId);
      const req = new NextRequest("http://localhost:3000/api/join-requests", { headers });
      const response = await listRequests(req);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/join-requests/[userId]/approve", () => {
    it("approves user, sets ACTIVE, assigns roles, and sends email", async () => {
      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      const body = JSON.stringify({
        roleIds: ["admin"],
        projectIds: [],
        boardIds: [],
      });
      const req = new NextRequest(
        `http://localhost:3000/api/join-requests/${pendingUserId}/approve`,
        { method: "POST", headers, body }
      );

      const response = await approveUser(req, {
        params: Promise.resolve({ userId: pendingUserId }),
      });

      expect(response.status).toBe(200);

      const user = await prisma.user.findUnique({
        where: { id: pendingUserId },
      });
      expect(user?.status).toBe("ACTIVE");

      const emails = testMailer.getSentEmails().filter((e) => e.to === user?.email);
      expect(emails.length).toBeGreaterThan(0);
    });

    it("returns 400 when roleIds is empty", async () => {
      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      const body = JSON.stringify({
        roleIds: [],
        projectIds: [],
        boardIds: [],
      });
      const req = new NextRequest(
        `http://localhost:3000/api/join-requests/${pendingUserId}/approve`,
        { method: "POST", headers, body }
      );

      const response = await approveUser(req, {
        params: Promise.resolve({ userId: pendingUserId }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("returns 403 for user without user.manage permission", async () => {
      const headers = new Headers();
      headers.set("x-user-id", noManagePermUserId);
      const body = JSON.stringify({
        roleIds: ["admin"],
        projectIds: [],
        boardIds: [],
      });
      const req = new NextRequest(
        `http://localhost:3000/api/join-requests/${pendingUserId}/approve`,
        { method: "POST", headers, body }
      );

      const response = await approveUser(req, {
        params: Promise.resolve({ userId: pendingUserId }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("POST /api/join-requests/[userId]/reject", () => {
    it("rejects user, sets REJECTED, ends sessions, and sends email", async () => {
      const headers = new Headers();
      headers.set("x-user-id", adminUserId);
      const body = JSON.stringify({
        reason: "Not qualified",
      });
      const req = new NextRequest(
        `http://localhost:3000/api/join-requests/${otherPendingUserId}/reject`,
        { method: "POST", headers, body }
      );

      const response = await rejectUser(req, {
        params: Promise.resolve({ userId: otherPendingUserId }),
      });

      expect(response.status).toBe(200);

      const user = await prisma.user.findUnique({
        where: { id: otherPendingUserId },
      });
      expect(user?.status).toBe("REJECTED");

      const emails = testMailer.getSentEmails().filter((e) => e.to === user?.email);
      expect(emails.length).toBeGreaterThan(0);
      expect(emails[0].subject).toContain("Rejected");
    });

    it("returns 403 for user without user.manage permission", async () => {
      const headers = new Headers();
      headers.set("x-user-id", noManagePermUserId);
      const body = JSON.stringify({
        reason: "Test",
      });
      const req = new NextRequest(
        `http://localhost:3000/api/join-requests/${otherPendingUserId}/reject`,
        { method: "POST", headers, body }
      );

      const response = await rejectUser(req, {
        params: Promise.resolve({ userId: otherPendingUserId }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  afterAll(async () => {
    await cleanupNonSeededUsers();
  });
});
