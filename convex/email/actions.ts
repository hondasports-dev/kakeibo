"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getRetryDelayMs, isMaxAttemptsReached } from "../../lib/email/retryPolicy";
import { getEmailProvider } from "./lib/providers";
import { buildTransactionalEmail } from "../../lib/email/templateFactory";

export async function processEmailJobHandler(
  ctx: ActionCtx,
  { jobId }: { jobId: Id<"transactionalEmailJobs"> },
): Promise<void> {
  const job = await ctx.runQuery(internal.email.internal.getJobById, { jobId });
  if (!job) {
    return;
  }

  if (
    job.status === "sent" ||
    job.status === "delivered" ||
    job.status === "bounced" ||
    job.status === "complained" ||
    job.status === "suppressed" ||
    job.status === "failed"
  ) {
    return;
  }

  const suppression = await ctx.runQuery(
    internal.email.suppressions.getSuppressionByNormalizedEmail,
    { normalizedEmail: job.normalizedRecipientEmail },
  );
  if (suppression) {
    await ctx.runMutation(internal.email.internal.updateJobForFailure, {
      jobId,
      status: "suppressed",
      updatedAt: Date.now(),
    });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(job.payloadJson);
  } catch {
    await ctx.runMutation(internal.email.internal.updateJobForFailure, {
      jobId,
      status: "failed",
      errorMessage: "Invalid payload JSON",
      errorCode: "invalid_request",
      updatedAt: Date.now(),
    });
    return;
  }

  const built = await buildTransactionalEmail(job.templateType, payload as never);

  const provider = getEmailProvider();
  const result = await provider.send({
    to: job.recipientEmail,
    from: process.env.RESEND_FROM_ADDRESS ?? "Suzumemo <noreply@example.com>",
    subject: built.subject,
    html: built.html,
    text: built.text,
    idempotencyKey: jobId,
  });

  const now = Date.now();

  if (result.ok) {
    await ctx.runMutation(internal.email.internal.updateJobForSend, {
      jobId,
      providerMessageId: result.providerMessageId,
      status: "sent",
      html: built.html,
      text: built.text,
      updatedAt: now,
    });
    return;
  }

  const error = result.error;
  const nextAttempt = job.attemptCount + 1;

  if (!error.retryable || isMaxAttemptsReached(nextAttempt)) {
    await ctx.runMutation(internal.email.internal.updateJobForFailure, {
      jobId,
      status: "failed",
      errorMessage: error.message,
      errorCode: error.code,
      updatedAt: now,
    });
    return;
  }

  const delay = getRetryDelayMs(nextAttempt);
  if (delay === null) {
    await ctx.runMutation(internal.email.internal.updateJobForFailure, {
      jobId,
      status: "failed",
      errorMessage: error.message,
      errorCode: error.code,
      updatedAt: now,
    });
    return;
  }

  await ctx.runMutation(internal.email.internal.updateJobForRetry, {
    jobId,
    status: "retrying",
    attemptCount: nextAttempt,
    nextRetryAt: now + delay,
    errorMessage: error.message,
    errorCode: error.code,
    updatedAt: now,
  });

  await ctx.scheduler.runAfter(delay, internal.email.actions.processEmailJob, { jobId });
}

export const processEmailJob = internalAction({
  args: {
    jobId: v.id("transactionalEmailJobs"),
  },
  handler: processEmailJobHandler,
});
