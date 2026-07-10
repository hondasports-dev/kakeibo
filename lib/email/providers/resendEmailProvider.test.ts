import { describe, it, expect, vi } from "vitest";
import { createResendEmailProvider } from "./resendEmailProvider";
import { SendEmailInput } from "../model";
import type { CreateEmailOptions, CreateEmailRequestOptions, CreateEmailResponse } from "resend";

describe("createResendEmailProvider", () => {
  const input: SendEmailInput = {
    to: "user@example.com",
    from: "Suzumemo <noreply@example.com>",
    subject: "Test",
    html: "<p>hello</p>",
    text: "hello",
    idempotencyKey: "idemp-1",
  };

  it("returns provider message id on success", async () => {
    const sendEmail = vi.fn(
      (
        _payload: CreateEmailOptions,
        _options?: CreateEmailRequestOptions,
      ): Promise<CreateEmailResponse> => Promise.resolve({ data: { id: "msg_123" }, error: null }),
    );
    const provider = createResendEmailProvider({ from: input.from, sendEmail });

    const result = await provider.send(input);

    expect(result).toEqual({ ok: true, providerMessageId: "msg_123" });
    expect(sendEmail).toHaveBeenCalledWith(
      {
        from: input.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      },
      { idempotencyKey: input.idempotencyKey },
    );
  });

  it("returns retryable error on 500", async () => {
    const sendEmail = vi.fn(
      (): Promise<CreateEmailResponse> =>
        Promise.resolve({
          data: null,
          error: { statusCode: 500, message: "Internal server error" } as any,
        }),
    );
    const provider = createResendEmailProvider({ from: input.from, sendEmail });

    const result = await provider.send(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retryable).toBe(true);
      expect(result.error.code).toBe("server_error");
    }
  });

  it("returns non-retryable error on invalid request", async () => {
    const sendEmail = vi.fn(
      (): Promise<CreateEmailResponse> =>
        Promise.resolve({
          data: null,
          error: { statusCode: 422, message: "Invalid email" } as any,
        }),
    );
    const provider = createResendEmailProvider({ from: input.from, sendEmail });

    const result = await provider.send(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retryable).toBe(false);
      expect(result.error.code).toBe("invalid_request");
    }
  });

  it("returns retryable error when send throws", async () => {
    const sendEmail = vi.fn(
      (): Promise<CreateEmailResponse> => Promise.reject(new Error("network timeout")),
    );
    const provider = createResendEmailProvider({ from: input.from, sendEmail });

    const result = await provider.send(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retryable).toBe(true);
    }
  });
});
