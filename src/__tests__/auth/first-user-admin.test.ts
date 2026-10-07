import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import prisma from "@/server/lib/prisma";
import { UserService } from "@/server/modules/users/service";
import { JoinRequestService } from "@/server/modules/join-requests/service";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { getMailer } from "@/server/lib/mailer";
import { cleanupNonSeededUsers } from "@/__tests__/__helpers__/seed";

const seededEmails = [
  'admin@example.com',
  'manager@example.com',
  'member@example.com',
  'viewer@example.com',
  'developer@example.com',
  'qa@example.com',
  'deployment@example.com',
];

describe("First User Admin Promotion", () => {
  let testMailer: ReturnType<typeof getMailer>;
  let createdUserIds: string[] = [];

  beforeEach(async () => {
    testMailer = getMailer();
    testMailer.clearSentEmails();
    createdUserIds = [];

    const nonSeeded = await prisma.user.findMany({
      where: {
        NOT: { email: { in: seededEmails } },
      },
      select: { id: true },
    });

    if (nonSeeded.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: { in: nonSeeded.map(u => u.id) },
        },
      });
    }
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
      createdUserIds = [];
    }
  });

  afterAll(async () => {
    await cleanupNonSeededUsers();
  });

  describe("promoteFirstUserToAdmin", () => {
    it("sets ACTIVE and assigns admin role if only user in database", async () => {
      await prisma.taskStageEntry.deleteMany({});
      await prisma.comment.deleteMany({});
      await prisma.attachment.deleteMany({});
      await prisma.task.deleteMany({});
      await prisma.columnRule.deleteMany({});
      await prisma.board.deleteMany({});
      await prisma.project.deleteMany({});
      await prisma.user.deleteMany({});

      const timestamp = Date.now();
      const rand = Math.random();

      const firstUser = await prisma.user.create({
        data: {
          name: "First User",
          email: `first-${timestamp}-${rand}@example.com`,
          status: "PENDING",
          isActive: true,
          emailVerified: true,
        },
      });
      createdUserIds.push(firstUser.id);

      await UserService.promoteFirstUserToAdmin(firstUser.id);

      const updated = await prisma.user.findUnique({ where: { id: firstUser.id } });
      expect(updated?.status).toBe("ACTIVE");

      const perms = getPerms();
      await setupPermissions();
      const hasAdminRole = await perms.user(firstUser.id).hasRole("admin");
      expect(hasAdminRole).toBe(true);
    });

    it("keeps PENDING if not the only user in database", async () => {
      await prisma.taskStageEntry.deleteMany({});
      await prisma.comment.deleteMany({});
      await prisma.attachment.deleteMany({});
      await prisma.task.deleteMany({});
      await prisma.columnRule.deleteMany({});
      await prisma.board.deleteMany({});
      await prisma.project.deleteMany({});
      await prisma.user.deleteMany({});

      const timestamp = Date.now();
      const rand = Math.random();

      const firstUser = await prisma.user.create({
        data: {
          name: "First User",
          email: `first-${timestamp}-${rand}@example.com`,
          status: "PENDING",
          isActive: true,
          emailVerified: true,
        },
      });
      createdUserIds.push(firstUser.id);

      const perms = getPerms();
      await setupPermissions();
      await perms.user(firstUser.id).assignRole("admin");

      const secondUser = await prisma.user.create({
        data: {
          name: "Second User",
          email: `second-${timestamp}-${rand}@example.com`,
          status: "PENDING",
          isActive: true,
          emailVerified: true,
        },
      });
      createdUserIds.push(secondUser.id);

      await UserService.promoteFirstUserToAdmin(secondUser.id);

      const updated = await prisma.user.findUnique({ where: { id: secondUser.id } });
      expect(updated?.status).toBe("PENDING");

      const secondHasAdminRole = await perms.user(secondUser.id).hasRole("admin");
      expect(secondHasAdminRole).toBe(false);
    });

    it("notifies admins when user verifies email", async () => {
      await prisma.taskStageEntry.deleteMany({});
      await prisma.comment.deleteMany({});
      await prisma.attachment.deleteMany({});
      await prisma.task.deleteMany({});
      await prisma.columnRule.deleteMany({});
      await prisma.board.deleteMany({});
      await prisma.project.deleteMany({});
      await prisma.user.deleteMany({});

      const timestamp = Date.now();
      const rand = Math.random();

      const admin = await prisma.user.create({
        data: {
          name: "Admin",
          email: `admin-${timestamp}-${rand}@example.com`,
          status: "ACTIVE",
          isActive: true,
          emailVerified: true,
        },
      });
      createdUserIds.push(admin.id);

      const perms = getPerms();
      await setupPermissions();
      await perms.user(admin.id).assignRole("admin");

      testMailer.clearSentEmails();

      const newUser = await prisma.user.create({
        data: {
          name: "New User",
          email: `newuser-${timestamp}-${rand}@example.com`,
          status: "PENDING",
          isActive: true,
          emailVerified: true,
        },
      });
      createdUserIds.push(newUser.id);

      await JoinRequestService.notifyManagers(newUser.id);

      const emails = testMailer.getSentEmails().filter((e) => e.to === admin.email);
      expect(emails.length).toBeGreaterThan(0);
      expect(emails[0].subject).toContain("New Account Approval Request");
    });
  });
});
