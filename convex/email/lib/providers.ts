import { Resend } from "resend";
import type { EmailProvider } from "../../../lib/email/model";
import { createResendEmailProvider } from "../../../lib/email/providers/resendEmailProvider";

export function mockEmailProvider(): EmailProvider {
  return {
    async send({ idempotencyKey }) {
      return {
        ok: true,
        providerMessageId: `mock-${idempotencyKey}`,
      };
    },
  };
}

export function getEmailProvider(): EmailProvider {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv !== "production") {
    return mockEmailProvider();
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }
  const from = process.env.RESEND_FROM_ADDRESS;
  if (!from) {
    throw new Error("Missing RESEND_FROM_ADDRESS");
  }

  const resend = new Resend(apiKey);
  return createResendEmailProvider({ from, sendEmail: resend.emails.send.bind(resend.emails) });
}
