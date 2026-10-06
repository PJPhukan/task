import { describe, it, expect, beforeEach } from "vitest";
import {
  Mailer,
  getMailer,
  setMailer,
  createVerifyEmailTemplate,
  createResetPasswordTemplate,
} from "./mailer";

describe("Mailer", () => {
  beforeEach(() => {
    const mailer = new Mailer();
    mailer.clearSentEmails();
    setMailer(mailer);
  });

  it("should send email in test mode", async () => {
    const mailer = new Mailer();
    await mailer.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    const sent = mailer.getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });
  });

  it("should share mailer instance through getMailer", async () => {
    const mailer = getMailer();
    await mailer.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    const mailer2 = getMailer();
    expect(mailer2.getSentEmails()).toHaveLength(1);
  });

  it("should clear sent emails", async () => {
    const mailer = getMailer();
    await mailer.send({
      to: "test@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    mailer.clearSentEmails();
    expect(mailer.getSentEmails()).toHaveLength(0);
  });

  it("should create verify email template", () => {
    const { html, text } = createVerifyEmailTemplate("https://example.com/verify");
    expect(text).toContain("https://example.com/verify");
    expect(html).toContain("https://example.com/verify");
  });

  it("should create reset password template", () => {
    const { html, text } = createResetPasswordTemplate("https://example.com/reset");
    expect(text).toContain("https://example.com/reset");
    expect(html).toContain("https://example.com/reset");
  });
});
