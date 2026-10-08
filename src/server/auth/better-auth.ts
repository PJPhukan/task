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
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    sendResetPassword: async (params: ResetPasswordParams) => {
      let resetUrl = params.url;
      try {
        const parsed = new URL(params.url);
        if (!parsed.searchParams.get("callbackURL")) {
          parsed.searchParams.set("callbackURL", "/reset-password");
        }
        resetUrl = parsed.toString();
      } catch {
        // Fallback
      }
      const mailer = getMailer();
      const { html, text } = createResetPasswordTemplate(resetUrl);
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
      let verifyUrl = params.url;
      try {
        const parsed = new URL(params.url);
        parsed.searchParams.set("callbackURL", "/email-verified");
        verifyUrl = parsed.toString();
      } catch {
        // Fallback to original url
      }
      const mailer = getMailer();
      const { html, text } = createVerifyEmailTemplate(verifyUrl);
      await mailer.send({
        to: params.user.email,
        subject: "Verify your email",
        html,
        text,
      });
    },
  },
  plugins: [],
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
  },
});
