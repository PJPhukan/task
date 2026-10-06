import { describe, it, expect, beforeEach } from "vitest";
import prisma from "@/server/lib/prisma";

describe("GET /api/me endpoint", () => {
  let activeUserId: string;
  let pendingUserId: string;
  let rejectedUserId: string;

  beforeEach(async () => {
    const timestamp = Date.now();
    const rand = Math.random();

    const activeUser = await prisma.user.create({
      data: {
        name: "Active User",
        email: `active-${timestamp}-${rand}@example.com`,
        status: "ACTIVE",
        isActive: true,
      },
    });
    activeUserId = activeUser.id;

    const pendingUser = await prisma.user.create({
      data: {
        name: "Pending User",
        email: `pending-${timestamp}-${rand}@example.com`,
        status: "PENDING",
        isActive: true,
      },
    });
    pendingUserId = pendingUser.id;

    const rejectedUser = await prisma.user.create({
      data: {
        name: "Rejected User",
        email: `rejected-${timestamp}-${rand}@example.com`,
        status: "REJECTED",
        isActive: true,
      },
    });
    rejectedUserId = rejectedUser.id;
  });

  it("returns full user info for ACTIVE user", async () => {
    const response = await fetch("http://localhost:3000/api/me", {
      headers: { "x-user-id": activeUserId },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(activeUserId);
    expect(data.user.name).toBe("Active User");
    expect(data.user.status).toBe("ACTIVE");
    expect(data.roles).toBeDefined();
    expect(data.permissions).toBeDefined();
  });

  it("returns only id, email, status for PENDING user", async () => {
    const response = await fetch("http://localhost:3000/api/me", {
      headers: { "x-user-id": pendingUserId },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(pendingUserId);
    expect(data.user.status).toBe("PENDING");
    expect(data.user.name).toBeUndefined();
    expect(data.roles).toBeUndefined();
  });

  it("returns only id, email, status for REJECTED user", async () => {
    const response = await fetch("http://localhost:3000/api/me", {
      headers: { "x-user-id": rejectedUserId },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(rejectedUserId);
    expect(data.user.status).toBe("REJECTED");
    expect(data.user.name).toBeUndefined();
    expect(data.roles).toBeUndefined();
  });

  it("returns 401 for non-existent user", async () => {
    const response = await fetch("http://localhost:3000/api/me", {
      headers: { "x-user-id": "invalid-user-id" },
    });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });
});
