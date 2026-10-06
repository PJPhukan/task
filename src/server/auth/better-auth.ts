import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import prisma from "@/server/lib/prisma";
import { getMailer, createVerifyEmailTemplate, createResetPasswordTemplate } from "@/server/lib/mailer";

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
  },
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
  plugins: [],
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
  },
});
