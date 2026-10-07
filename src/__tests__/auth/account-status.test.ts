import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { checkAccountStatus } from "@/server/auth/check-account-status";
import prisma from "@/server/lib/prisma";
import { cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

describe("Account Status Check", () => {
  let testUserId: string;

  beforeEach(async () => {
    const testEmail = `test-status-${Date.now()}-${Math.random()}@example.com`;
    const user = await prisma.user.create({
      data: {
        name: "Test User",
        email: testEmail,
        isActive: true,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await cleanupNonSeededUsers();
  });

  it("returns authorized for ACTIVE user", async () => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { status: "ACTIVE" },
    });

    const result = await checkAccountStatus(testUserId);
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(testUserId);
    }
  });

  it("returns 403 ACCOUNT_PENDING for PENDING user", async () => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { status: "PENDING" },
    });

    const result = await checkAccountStatus(testUserId);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(403);
      const json = await result.response.json();
      expect(json.error.code).toBe("ACCOUNT_PENDING");
    }
  });

  it("returns 403 ACCOUNT_REJECTED for REJECTED user", async () => {
    await prisma.user.update({
      where: { id: testUserId },
      data: { status: "REJECTED" },
    });

    const result = await checkAccountStatus(testUserId);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(403);
      const json = await result.response.json();
      expect(json.error.code).toBe("ACCOUNT_REJECTED");
    }
  });

  it("returns 401 for non-existent user", async () => {
    const result = await checkAccountStatus("invalid-user-id");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });
});
