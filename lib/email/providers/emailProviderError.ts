import { EmailProviderError } from "../model";

export function classifyResendApiError({
  statusCode,
  message,
  error,
}: {
  statusCode?: number;
  message: string;
  error?: { code?: string; name?: string };
}): EmailProviderError {
  const code = error?.code ?? error?.name;

  if (statusCode === 429) {
    return new EmailProviderError("rate_limited", message, true, "resend");
  }

  if (code === "suppressed") {
    return new EmailProviderError("suppressed", message, false, "resend");
  }

  if (statusCode === 400 || statusCode === 422) {
    return new EmailProviderError("invalid_request", message, false, "resend");
  }

  if (statusCode === 401 || statusCode === 403) {
    return new EmailProviderError("configuration_error", message, false, "resend");
  }

  if (statusCode && statusCode >= 500) {
    return new EmailProviderError("server_error", message, true, "resend");
  }

  if (message.toLowerCase().includes("timeout")) {
    return new EmailProviderError("timeout", message, true, "resend");
  }

  return new EmailProviderError("unknown", message, true, "resend");
}
