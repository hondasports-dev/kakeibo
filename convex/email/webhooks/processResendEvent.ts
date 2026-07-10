import { ConvexError, v } from "convex/values";
import { internalMutation } from "../../_generated/server";
import type { MutationCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import {
  normalizeEmail,
  type EmailSuppressionReason,
  type EmailWebhookEventType,
} from "../../../lib/email/model";
import { emailWebhookEventTypeValidator } from "../model";

export type WebhookPayloadData = {
  email_id?: string;
  created_at?: string;
  to?: string[];
  from?: string;
  subject?: string;
  bounce?: { type?: string };
  complaint?: { type?: string };
  suppressed?: { type?: string };
  failed?: { reason?: string };
};

export async function processResendEventHandler(
  ctx: MutationCtx,
  args: {
    svixId: string;
    provider: string;
    eventType: EmailWebhookEventType;
    payloadJson: string;
    processedAt: number;
  },
): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(args.payloadJson);
  } catch {
    throw new ConvexError("Invalid webhook payload JSON");
  }

  const typedData = data as WebhookPayloadData;

  const providerMessageId = typedData.email_id;
  const recipientEmail = typedData.to?.[0];
  let eventCreatedAt: number | undefined;
  if (typedData.created_at) {
    const parsed = Date.parse(typedData.created_at);
    eventCreatedAt = Number.isNaN(parsed) ? undefined : parsed;
  }

  const duplicate = await ctx.runQuery(internal.email.internal.getWebhookEventBySvixId, {
    svixId: args.svixId,
  });
  if (duplicate) {
    return;
  }

  let statusUpdate:
    | NonNullable<ReturnType<typeof resolveStatusAndSuppression>>["statusUpdate"]
    | undefined;
  let suppressionReason: EmailSuppressionReason | undefined;
  let suppressionSource: string | undefined;
  const resolved = resolveStatusAndSuppression(args.eventType, typedData);
  if (resolved) {
    statusUpdate = resolved.statusUpdate;
    suppressionReason = resolved.suppressionReason;
    suppressionSource = resolved.suppressionSource;
  }

  const now = Date.now();

  await ctx.db.insert("emailWebhookEvents", {
    svixId: args.svixId,
    provider: args.provider,
    eventType: args.eventType,
    providerMessageId,
    recipientEmail,
    payloadJson: args.payloadJson,
    eventCreatedAt,
    processedAt: args.processedAt,
    createdAt: now,
  });

  if (!providerMessageId || !statusUpdate) {
    return;
  }

  const job = await ctx.runQuery(internal.email.internal.getJobByProviderMessageId, {
    providerMessageId,
  });
  if (!job) {
    return;
  }

  const latestEvent = await ctx.runQuery(
    internal.email.internal.getLatestWebhookEventForProviderMessageId,
    { providerMessageId },
  );

  if (
    latestEvent &&
    latestEvent.eventCreatedAt !== undefined &&
    eventCreatedAt !== undefined &&
    latestEvent.eventCreatedAt > eventCreatedAt
  ) {
    return;
  }

  await ctx.runMutation(internal.email.internal.updateJobStatusFromWebhook, {
    jobId: job._id,
    status: statusUpdate,
    lastProviderEventAt: eventCreatedAt ?? now,
    updatedAt: now,
  });

  if (suppressionReason && recipientEmail) {
    await ctx.runMutation(internal.email.suppressions.upsertSuppression, {
      email: recipientEmail,
      normalizedEmail: normalizeEmail(recipientEmail),
      reason: suppressionReason,
      source: suppressionSource,
      providerMessageId,
      createdAt: now,
    });
  }
}

export const processResendEvent = internalMutation({
  args: {
    svixId: v.string(),
    provider: v.string(),
    eventType: emailWebhookEventTypeValidator,
    payloadJson: v.string(),
    processedAt: v.number(),
  },
  handler: processResendEventHandler,
});

export function resolveStatusAndSuppression(
  eventType: EmailWebhookEventType,
  data: {
    bounce?: { type?: string };
    complaint?: { type?: string };
    suppressed?: { type?: string };
    failed?: { reason?: string };
  },
):
  | {
      statusUpdate: "sent" | "delivered" | "bounced" | "complained" | "suppressed" | "failed";
      suppressionReason?: EmailSuppressionReason;
      suppressionSource?: string;
    }
  | undefined {
  switch (eventType) {
    case "email.sent":
      return { statusUpdate: "sent" };
    case "email.delivered":
      return { statusUpdate: "delivered" };
    case "email.delivery_delayed":
      return undefined;
    case "email.complained":
      return {
        statusUpdate: "complained",
        suppressionReason: "complaint",
        suppressionSource: data.complaint?.type,
      };
    case "email.bounced":
      return {
        statusUpdate: "bounced",
        suppressionReason: "bounce",
        suppressionSource: data.bounce?.type,
      };
    case "email.suppressed":
      return {
        statusUpdate: "suppressed",
        suppressionReason: "provider_suppressed",
        suppressionSource: data.suppressed?.type,
      };
    case "email.failed":
      return { statusUpdate: "failed" };
    default:
      return undefined;
  }
}
