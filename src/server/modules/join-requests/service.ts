import "server-only";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { ApproveJoinRequestInput, RejectJoinRequestInput } from "./schema";
import { getMailer } from "@/server/lib/mailer";

export class JoinRequestService {
  static async listPendingUsers() {
    const users = await prisma.user.findMany({
      where: {
        status: "PENDING",
        emailVerified: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return users;
  }

  static async approveUser(userId: string, input: ApproveJoinRequestInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { sessions: true },
    });

    if (!user) throw new Error("User not found");
    if (user.status !== "PENDING") throw new Error("User is not pending");

    const perms = getPerms();
    await setupPermissions();

    // Transaction: update user, assign roles, add to projects and boards
    await prisma.$transaction(async (tx) => {
      // Set user to ACTIVE
      await tx.user.update({
        where: { id: userId },
        data: { status: "ACTIVE" },
      });

      // Assign roles
      for (const roleId of input.roleIds) {
        await perms.user(userId).assignRole(roleId);
      }

      // Add to projects
      if (input.projectIds && input.projectIds.length > 0) {
        for (const projectId of input.projectIds) {
          const existingMember = await tx.projectMember.findFirst({
            where: { userId, projectId },
          });

          if (!existingMember) {
            await tx.projectMember.create({
              data: {
                userId,
                projectId,
              },
            });
          }
        }
      }

      // Grant board access
      if (input.boardIds && input.boardIds.length > 0) {
        for (const boardId of input.boardIds) {
          const existingAccess = await tx.boardAccess.findFirst({
            where: { boardId, userId },
          });

          if (!existingAccess) {
            await tx.boardAccess.create({
              data: {
                boardId,
                userId,
              },
            });
          }
        }
      }
    });

    // Send approval email
    const mailer = getMailer();
    await mailer.send({
      to: user.email,
      subject: "Your Account Has Been Approved",
      html: `<p>Welcome! Your account has been approved. You can now sign in at http://localhost:3000</p>`,
      text: `Welcome! Your account has been approved. You can now sign in at http://localhost:3000`,
    });
  }

  static async rejectUser(userId: string, input: RejectJoinRequestInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { sessions: true },
    });

    if (!user) throw new Error("User not found");
    if (user.status !== "PENDING") throw new Error("User is not pending");

    // Transaction: update user and end sessions
    await prisma.$transaction(async (tx) => {
      // Set user to REJECTED
      await tx.user.update({
        where: { id: userId },
        data: { status: "REJECTED" },
      });

      // End all sessions
      await tx.session.deleteMany({
        where: { userId },
      });
    });

    // Send rejection email
    const mailer = getMailer();
    const reason = input.reason || "Your request was not approved at this time.";
    await mailer.send({
      to: user.email,
      subject: "Your Account Request Was Rejected",
      html: `<p>Unfortunately, your account request was not approved. ${reason}</p>`,
      text: `Unfortunately, your account request was not approved. ${reason}`,
    });
  }

  static async notifyManagers(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return;

    // Get all active users with user.manage permission
    const managers = await this.getUsersWithPermission("user.manage");

    const mailer = getMailer();
    for (const manager of managers) {
      await mailer.send({
        to: manager.email,
        subject: "New Account Approval Request",
        html: `<p>A new user (${user.name}) has verified their email and is waiting for approval.</p>`,
        text: `A new user (${user.name}) has verified their email and is waiting for approval.`,
      });
    }
  }

  private static async getUsersWithPermission(permission: string) {
    const perms = getPerms();
    await setupPermissions();

    const allUsers = await prisma.user.findMany({
      where: { status: "ACTIVE", isActive: true },
      select: { id: true, email: true },
    });

    const usersWithPermission = [];
    for (const user of allUsers) {
      const hasPermission = await perms.user(user.id).can(permission);
      if (hasPermission) {
        usersWithPermission.push(user);
      }
    }

    return usersWithPermission;
  }
}
