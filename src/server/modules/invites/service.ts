import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/server/lib/prisma";
import { getPerms, setupPermissions } from "@/server/lib/permly";
import { getMailer } from "@/server/lib/mailer";
import { CreateInviteInput } from "./schema";
import { hashPassword } from "@better-auth/utils/password";

export class InviteService {
  private static INVITE_EXPIRY_DAYS = 7;

  private static hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private static generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  static async createInvite(input: CreateInviteInput, invitedById: string) {
    // Check if email already has an account
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    // Revoke any pending invites for this email
    await prisma.invite.updateMany({
      where: { email: input.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Generate token
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    // Create invite
    const expiresAt = new Date(Date.now() + this.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const invite = await prisma.invite.create({
      data: {
        email: input.email,
        tokenHash,
        roleIds: input.roleIds,
        projectIds: input.projectIds || [],
        boardIds: input.boardIds || [],
        expiresAt,
        invitedById,
      },
      include: { invitedBy: { select: { name: true, email: true } } },
    });

    // Send email
    await this.sendInviteEmail(input.email, token, invite.invitedBy.name);

    return {
      id: invite.id,
      email: invite.email,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      invitedBy: invite.invitedBy.name,
    };
  }

  static async listInvites() {
    const invites = await prisma.invite.findMany({
      where: {
        acceptedAt: null,
        revokedAt: null,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        expiresAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return invites.map((inv) => ({
      ...inv,
      invitedBy: inv.invitedBy.name,
    }));
  }

  static async revokeInvite(inviteId: string) {
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.revokedAt || invite.acceptedAt) {
      throw new Error("Invite is already revoked or accepted");
    }

    await prisma.invite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
  }

  static async resendInvite(inviteId: string) {
    const invite = await prisma.invite.findUnique({
      where: { id: inviteId },
      include: { invitedBy: { select: { name: true } } },
    });

    if (!invite) {
      throw new Error("Invite not found");
    }

    if (invite.revokedAt || invite.acceptedAt) {
      throw new Error("Invite is already revoked or accepted");
    }

    // Generate new token
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    // Extend expiry and update token
    const expiresAt = new Date(Date.now() + this.INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await prisma.invite.update({
      where: { id: inviteId },
      data: {
        tokenHash,
        expiresAt,
      },
    });

    // Send email
    await this.sendInviteEmail(invite.email, token, invite.invitedBy.name);

    return {
      id: invite.id,
      email: invite.email,
      expiresAt,
    };
  }

  static async validateToken(token: string) {
    const tokenHash = this.hashToken(token);

    const invite = await prisma.invite.findUnique({
      where: { tokenHash },
      include: { invitedBy: { select: { name: true } } },
    });

    if (!invite) {
      return null;
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      return null;
    }

    // Check if revoked or already accepted
    if (invite.revokedAt || invite.acceptedAt) {
      return null;
    }

    return {
      email: invite.email,
      invitedBy: invite.invitedBy.name,
    };
  }

  static async acceptInvite(token: string, name: string, password: string) {
    const tokenHash = this.hashToken(token);

    // Validate token
    const invite = await prisma.invite.findUnique({
      where: { tokenHash },
    });

    if (!invite) {
      throw new Error("Invalid or expired token");
    }

    // Check if expired
    if (invite.expiresAt < new Date()) {
      throw new Error("Token has expired");
    }

    // Check if already accepted or revoked
    if (invite.acceptedAt || invite.revokedAt) {
      throw new Error("Token has already been used");
    }

    // Check if all granted roles still exist
    const perms = getPerms();
    await setupPermissions();

    for (const roleId of invite.roleIds) {
      // Try to get the role - if it returns null, it doesn't exist
      const roleCheck = await (perms as any).role(roleId).getPermissions().catch(() => null);
      if (!roleCheck) {
        throw new Error("One or more granted roles no longer exist");
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user in transaction with invite acceptance
    const user = await prisma.$transaction(async (tx) => {
      // Create user
      const newUser = await tx.user.create({
        data: {
          name,
          email: invite.email,
          emailVerified: true,
          status: "ACTIVE",
          isActive: true,
        },
      });

      // Create account with password
      await tx.account.create({
        data: {
          userId: newUser.id,
          providerId: "credential",
          accountId: newUser.id,
          password: hashedPassword,
        },
      });

      // Assign roles
      for (const roleId of invite.roleIds) {
        await perms.user(newUser.id).assignRole(roleId);
      }

      // Add to projects
      if (invite.projectIds.length > 0) {
        for (const projectId of invite.projectIds) {
          await tx.projectMember.create({
            data: {
              userId: newUser.id,
              projectId,
            },
          });
        }
      }

      // Grant board access
      if (invite.boardIds.length > 0) {
        for (const boardId of invite.boardIds) {
          await tx.boardAccess.create({
            data: {
              userId: newUser.id,
              boardId,
            },
          });
        }
      }

      // Mark invite as accepted
      await tx.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      });

      return newUser;
    });

    const roles = await perms.user(user.id).getRoles();
    const permissions = await perms.user(user.id).getPermissions({ expand: true });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      isActive: user.isActive,
      roles,
      permissions,
    };
  }

  private static async sendInviteEmail(email: string, token: string, inviterName: string) {
    const mailer = getMailer();
    const inviteLink = `${process.env.APP_URL || "http://localhost:3000"}/accept-invite?token=${token}`;

    await mailer.send({
      to: email,
      subject: `You've been invited to join`,
      html: `<p>${inviterName} has invited you to join. Click the link below to accept:</p><p><a href="${inviteLink}">${inviteLink}</a></p>`,
      text: `${inviterName} has invited you to join. Visit this link to accept: ${inviteLink}`,
    });
  }
}
