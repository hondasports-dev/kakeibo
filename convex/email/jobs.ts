import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  getTemplateSubject,
  validatePayloadForTemplate,
} from "../../lib/email/templateDefinitions";
import { normalizeEmail } from "../../lib/email/model";
import { transactionalEmailTypeValidator } from "./model";
import type { TransactionalEmailType } from "../../lib/email/model";

export async function enqueueTransactionalEmailJobHandler(
  ctx: MutationCtx,
  {
    templateType,
    payloadJson,
    recipientEmail,
    businessDedupeKey,
  }: {
    templateType: TransactionalEmailType;
    payloadJson: string;
    recipientEmail: string;
    businessDedupeKey?: string;
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

  const subject = getTemplateSubject(templateType);
  const normalized = normalizeEmail(recipientEmail);
  const now = Date.now();

  if (businessDedupeKey) {
    const existing = await ctx.db
      .query("transactionalEmailJobs")
      .withIndex("by_business_dedupe_key", (q) => q.eq("businessDedupeKey", businessDedupeKey))
      .unique();
    if (existing) return existing._id;
  }

  const jobId = await ctx.db.insert("transactionalEmailJobs", {
    templateType,
    payloadJson,
    recipientEmail,
    normalizedRecipientEmail: normalized,
    subject: subject ?? "",
    ...(businessDedupeKey ? { businessDedupeKey } : {}),
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
    businessDedupeKey: v.optional(v.string()),
  },
  handler: enqueueTransactionalEmailJobHandler,
});
