import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  buildTransactionalEmail,
  validatePayloadForTemplate,
} from "../../lib/email/templateFactory";
import { normalizeEmail } from "../../lib/email/model";
import { transactionalEmailTypeValidator } from "./model";
import type { TransactionalEmailType } from "../../lib/email/model";

export async function enqueueTransactionalEmailJobHandler(
  ctx: MutationCtx,
  {
    templateType,
    payloadJson,
    recipientEmail,
  }: {
    templateType: TransactionalEmailType;
    payloadJson: string;
    recipientEmail: string;
  },
): Promise<string> {
  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    throw new ConvexError("Invalid payload JSON");
  }

  const validation = validatePayloadForTemplate(templateType, payload);
  if (!validation.success) {
    throw new ConvexError("Invalid transactional email payload");
  }

  const built = await buildTransactionalEmail(templateType, validation.data);
  const normalized = normalizeEmail(recipientEmail);
  const now = Date.now();

  const jobId = await ctx.db.insert("transactionalEmailJobs", {
    templateType,
    payloadJson,
    recipientEmail,
    normalizedRecipientEmail: normalized,
    subject: built.subject,
    html: built.html,
    text: built.text,
    provider: "resend",
    status: "queued",
    attemptCount: 0,
    maxAttempts: 6,
    createdAt: now,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(0, internal.email.actions.processEmailJob, { jobId });

  return jobId;
}

export const enqueueTransactionalEmailJob = internalMutation({
  args: {
    templateType: transactionalEmailTypeValidator,
    payloadJson: v.string(),
    recipientEmail: v.string(),
  },
  handler: enqueueTransactionalEmailJobHandler,
});
