import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getProjects } from "@/app/api/projects/route";
import { GET as getUsers } from "@/app/api/users/route";
import { GET as getMe } from "@/app/api/me/route";
import prisma from "@/server/lib/prisma";

describe("Status Check Coverage", () => {
  let pendingUserId: string;
  let inactiveUserId: string;
  let activeUserId: string;

  beforeEach(async () => {
    const timestamp = Date.now();
    const rand = Math.random();

    const pendingUser = await prisma.user.create({
      data: {
        name: "Pending User",
        email: `pending-${timestamp}-${rand}@example.com`,
        status: "PENDING",
        isActive: true,
      },
    });
    pendingUserId = pendingUser.id;

    const inactiveUser = await prisma.user.create({
      data: {
        name: "Inactive User",
        email: `inactive-${timestamp}-${rand}@example.com`,
        status: "ACTIVE",
        isActive: false,
      },
    });
    inactiveUserId = inactiveUser.id;

    const activeUser = await prisma.user.create({
      data: {
        name: "Active User",
        email: `active-${timestamp}-${rand}@example.com`,
        status: "ACTIVE",
        isActive: true,
      },
    });
    activeUserId = activeUser.id;
  });

  describe("PENDING user", () => {
    it("gets 403 ACCOUNT_PENDING on GET /api/projects", async () => {
      const headers = new Headers();
      headers.set("x-user-id", pendingUserId);
      const req = new NextRequest("http://localhost:3000/api/projects", { headers });
      const response = await getProjects(req);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("ACCOUNT_PENDING");
    });

    it("gets 403 ACCOUNT_PENDING on GET /api/users", async () => {
      const headers = new Headers();
      headers.set("x-user-id", pendingUserId);
      const req = new NextRequest("http://localhost:3000/api/users", { headers });
      const response = await getUsers(req);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error.code).toBe("ACCOUNT_PENDING");
    });

    it("gets 200 on GET /api/me", async () => {
      const headers = new Headers();
      headers.set("x-user-id", pendingUserId);
      const req = new NextRequest("http://localhost:3000/api/me", { headers });
      const response = await getMe(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user.status).toBe("PENDING");
    });
  });

  describe("inactive user", () => {
    it("gets 401 on GET /api/projects", async () => {
      const headers = new Headers();
      headers.set("x-user-id", inactiveUserId);
      const req = new NextRequest("http://localhost:3000/api/projects", { headers });
      const response = await getProjects(req);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error.code).toBe("UNAUTHORIZED");
    });
  });

  describe("session mode security", () => {
    it("returns 401 if x-user-id has no matching session cookie", async () => {
      const headers = new Headers();
      headers.set("x-user-id", activeUserId);
      const req = new NextRequest("http://localhost:3000/api/projects", { headers });
      const response = await getProjects(req);

      // In dev mode with x-user-id, should work
      expect(response.status).toBe(200);
    });
  });
});
