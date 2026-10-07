import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface FakeTransporter {
  sent: EmailPayload[];
  shouldFail?: boolean;
  sendMail(_payload: EmailPayload): Promise<void>;
}

let activeMailer: Mailer = null as any;

export class Mailer {
  private transporter: (Transporter<any>) | FakeTransporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (process.env.NODE_ENV === "test") {
      this.transporter = createFakeTransporter();
      return;
    }

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
      this.transporter = createFakeTransporter();
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: parseInt(smtpPort, 10) === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  }

  async send(payload: EmailPayload): Promise<void> {
    if (!this.transporter) {
      console.log(
        `[MAIL] To: ${payload.to}, Subject: ${payload.subject}, Body: ${payload.text}`
      );
      return;
    }

    const from = process.env.MAIL_FROM || "noreply@example.com";
    if ("sent" in this.transporter) {
      await this.transporter.sendMail(payload);
    } else {
      await this.transporter.sendMail({
        from,
        ...payload,
      });
    }
  }

  getSentEmails(): EmailPayload[] {
    if (this.transporter && "sent" in this.transporter) {
      return this.transporter.sent;
    }
    return [];
  }

  clearSentEmails(): void {
    if (this.transporter && "sent" in this.transporter) {
      this.transporter.sent = [];
    }
  }

  setFakeShouldFail(shouldFail: boolean): void {
    if (this.transporter && "shouldFail" in this.transporter) {
      this.transporter.shouldFail = shouldFail;
    }
  }

  isFakeTransporter(): boolean {
    return this.transporter != null && "sent" in this.transporter;
  }
}

function createFakeTransporter(): FakeTransporter {
  return {
    sent: [],
    shouldFail: false,
    async sendMail(payload: EmailPayload) {
      if (this.shouldFail) {
        throw new Error("Fake mailer is set to fail");
      }
      console.log(
        `[MAIL] To: ${payload.to}, Subject: ${payload.subject}, Body: ${payload.text}`
      );
      this.sent.push(payload);
    },
  };
}

export function getMailer(): Mailer {
  if (!activeMailer) {
    activeMailer = new Mailer();
  }
  return activeMailer;
}

export function setMailer(mailer: Mailer): void {
  activeMailer = mailer;
}

export function createVerifyEmailTemplate(
  verifyUrl: string
): { html: string; text: string } {
  const text = `Please verify your email by visiting: ${verifyUrl}`;
  const html = `
    <p>Please verify your email by clicking the link below:</p>
    <a href="${verifyUrl}">Verify Email</a>
  `;
  return { html, text };
}

export function createResetPasswordTemplate(
  resetUrl: string
): { html: string; text: string } {
  const text = `Reset your password by visiting: ${resetUrl}`;
  const html = `
    <p>Reset your password by clicking the link below:</p>
    <a href="${resetUrl}">Reset Password</a>
  `;
  return { html, text };
}
