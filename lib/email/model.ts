export const TRANSACTIONAL_EMAIL_TYPES = ["email_delivery_test"] as const;

export type TransactionalEmailType = (typeof TRANSACTIONAL_EMAIL_TYPES)[number];

export type EmailDeliveryTestPayload = {
  to: string;
  groupName?: string;
};

export type TransactionalEmailPayload = {
  email_delivery_test: EmailDeliveryTestPayload;
};

export type BuiltEmail = {
  subject: string;
  html: string;
  text: string;
};

export type SendEmailInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type SendEmailSuccess = {
  ok: true;
  providerMessageId: string;
};

export type SendEmailFailure = {
  ok: false;
  error: EmailProviderError;
};

export type SendEmailResult = SendEmailSuccess | SendEmailFailure;

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export type EmailProviderErrorCode =
  | "rate_limited"
  | "timeout"
  | "server_error"
  | "invalid_request"
  | "unknown"
  | "suppressed"
  | "configuration_error";

export class EmailProviderError extends Error {
  readonly code: EmailProviderErrorCode;
  readonly retryable: boolean;
  readonly provider: string;
  readonly underlyingError?: unknown;

  constructor(
    code: EmailProviderErrorCode,
    message: string,
    retryable: boolean,
    provider: string,
    underlyingError?: unknown,
  ) {
    super(message);
    this.name = "EmailProviderError";
    this.code = code;
    this.retryable = retryable;
    this.provider = provider;
    this.underlyingError = underlyingError;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type TransactionalEmailJobStatus =
  | "queued"
  | "processing"
  | "sent"
  | "delivered"
  | "bounced"
  | "complained"
  | "suppressed"
  | "failed"
  | "retrying";

export type EmailSuppressionReason = "bounce" | "complaint" | "provider_suppressed";

export type EmailWebhookEventType =
  | "email.sent"
  | "email.delivered"
  | "email.delivery_delayed"
  | "email.complained"
  | "email.bounced"
  | "email.failed"
  | "email.suppressed";
