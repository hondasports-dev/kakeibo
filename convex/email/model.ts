import { v } from "convex/values";

export const TRANSACTIONAL_EMAIL_TYPES = ["email_delivery_test"] as const;

export const transactionalEmailTypeValidator = v.union(
  ...TRANSACTIONAL_EMAIL_TYPES.map((t) => v.literal(t)),
);

export const TRANSACTIONAL_EMAIL_JOB_STATUSES = [
  "queued",
  "processing",
  "sent",
  "delivered",
  "bounced",
  "complained",
  "suppressed",
  "failed",
  "retrying",
] as const;

export const transactionalEmailJobStatusValidator = v.union(
  ...TRANSACTIONAL_EMAIL_JOB_STATUSES.map((s) => v.literal(s)),
);

export const EMAIL_SUPPRESSION_REASONS = ["bounce", "complaint", "provider_suppressed"] as const;

export const emailSuppressionReasonValidator = v.union(
  ...EMAIL_SUPPRESSION_REASONS.map((r) => v.literal(r)),
);

export const EMAIL_WEBHOOK_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.complained",
  "email.bounced",
  "email.failed",
  "email.suppressed",
] as const;

export const emailWebhookEventTypeValidator = v.union(
  ...EMAIL_WEBHOOK_EVENT_TYPES.map((t) => v.literal(t)),
);
