import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import prisma from "@/server/lib/prisma";
import { getMailer, createVerifyEmailTemplate, createResetPasswordTemplate } from "@/server/lib/mailer";
import { UserService } from "@/server/modules/users/service";
import { JoinRequestService } from "@/server/modules/join-requests/service";

interface EmailVerificationParams {
  user: { email: string };
  url: string;
}

interface ResetPasswordParams {
  user: { email: string };
  url: string;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  basePath: "/api/auth",
  trustedOrigins: [process.env.APP_URL || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    sendResetPassword: async (params: ResetPasswordParams) => {
      const mailer = getMailer();
      const { html, text } = createResetPasswordTemplate(params.url);
      await mailer.send({
        to: params.user.email,
        subject: "Reset your password",
        html,
        text,
      });
    },
  },
  emailVerification: {
    sendVerificationEmail: async (params: EmailVerificationParams) => {
      const mailer = getMailer();
      const { html, text } = createVerifyEmailTemplate(params.url);
      await mailer.send({
        to: params.user.email,
        subject: "Verify your email",
        html,
        text,
      });
    },
    async sendVerificationEmailOnSignUp() {
      return true;
    },
    async onEmailVerified({ user }: any) {
      try {
        await UserService.promoteFirstUserToAdmin(user.id);
        await JoinRequestService.notifyManagers(user.id);
      } catch (error) {
        console.error("Failed to process email verification:", error);
      }
    },
  },
  plugins: [],
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
  },
});
