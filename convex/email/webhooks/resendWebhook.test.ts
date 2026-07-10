// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ActionCtx } from "../../_generated/server";
import { createResendWebhookHandler } from "./resendWebhook";

beforeEach(() => {
  process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
});

function createActionCtx(): ActionCtx {
  return {
    runMutation: vi.fn().mockResolvedValue(undefined),
    runQuery: vi.fn().mockResolvedValue(null),
    runAction: vi.fn().mockResolvedValue(undefined),
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
    auth: { getUserIdentity: vi.fn().mockResolvedValue(null) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as ActionCtx;
}

function createRequest({
  body,
  headers,
}: {
  body: string;
  headers: Record<string, string>;
}): Request {
  const request = new Request("https://example.com/webhooks/resend", {
    method: "POST",
    body,
    headers,
  });
  return request;
}

describe("createResendWebhookHandler", () => {
  it("returns 401 when verification fails", async () => {
    const handler = createResendWebhookHandler(() => {
      throw new Error("invalid signature");
    });
    const ctx = createActionCtx();
    const req = createRequest({
      body: "{}",
      headers: {
        "webhook-id": "id-1",
        "webhook-timestamp": "1000",
        "webhook-signature": "sig",
      },
    });

    const response = await handler(ctx, req);

    expect(response.status).toBe(401);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("returns 200 and processes email webhook events", async () => {
    const handler = createResendWebhookHandler(() => ({
      type: "email.delivered",
      data: {
        email_id: "msg-1",
        created_at: "2026-07-10T12:00:00Z",
        to: ["test@example.com"],
        from: "noreply@example.com",
        subject: "test",
      },
    }));

    const ctx = createActionCtx();
    const req = createRequest({
      body: "{}",
      headers: {
        "webhook-id": "id-1",
        "webhook-timestamp": "1000",
        "webhook-signature": "sig",
      },
    });

    const response = await handler(ctx, req);

    expect(response.status).toBe(200);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        svixId: "id-1",
        provider: "resend",
        eventType: "email.delivered",
      }),
    );
  });

  it("returns 200 without processing for unsupported event types", async () => {
    const handler = createResendWebhookHandler(() => ({
      type: "email.clicked",
      data: {},
    }));

    const ctx = createActionCtx();
    const req = createRequest({
      body: "{}",
      headers: {
        "webhook-id": "id-1",
        "webhook-timestamp": "1000",
        "webhook-signature": "sig",
      },
    });

    const response = await handler(ctx, req);

    expect(response.status).toBe(200);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
