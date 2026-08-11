import type { ActionCtx } from "../_generated/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLineWebhookHandler, MAX_RAW_BODY_BYTES } from "./webhook";

const asAny = (value: unknown): any => value as any;

class MockResponse {
  status: number;
  body: string;

  constructor(body: string, init?: { status?: number }) {
    this.body = body;
    this.status = init?.status ?? 200;
  }
}

function createActionCtx(
  mutationResult = { claimedCount: 1, duplicateCount: 0, guideReplies: [] },
) {
  return {
    runMutation: vi.fn().mockResolvedValue(mutationResult),
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
  } as unknown as ActionCtx;
}

function createRequest(body: string, signature: string | null = "signature") {
  return {
    text: () => Promise.resolve(body),
    headers: { get: (name: string) => (name === "x-line-signature" ? signature : null) },
  };
}

describe("LINE webhook HTTP handler", () => {
  beforeEach(() => {
    process.env.LINE_MESSAGING_CHANNEL_SECRET = "channel-secret";
    (globalThis as any).Response = MockResponse;
  });

  it("署名検証後にraw payloadを正規化し、未連携案内をscheduleする", async () => {
    const scheduleGuide = vi.fn().mockResolvedValue(undefined);
    const verifySignature = vi.fn().mockResolvedValue(true);
    const ctx = createActionCtx({
      claimedCount: 1,
      duplicateCount: 0,
      guideReplies: [{ replyToken: "reply-token" }],
    });
    const rawBody = JSON.stringify({
      events: [
        {
          type: "follow",
          webhookEventId: "event-follow",
          source: { type: "user", userId: "line-user-private" },
          replyToken: "reply-token",
        },
      ],
    });
    const handler = createLineWebhookHandler(verifySignature, scheduleGuide);

    const response = (await asAny(handler)(ctx, createRequest(rawBody))) as MockResponse;

    expect(response.status).toBe(200);
    expect(verifySignature).toHaveBeenCalledWith(rawBody, "signature", "channel-secret");
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        events: [
          expect.objectContaining({
            webhookEventId: "event-follow",
            eventType: "follow",
            lineUserId: "line-user-private",
          }),
        ],
      }),
    );
    expect(scheduleGuide).toHaveBeenCalledWith(ctx, "reply-token");
  });

  it.each([
    ["secretなし", undefined, "signature", 500],
    ["署名なし", "channel-secret", null, 401],
    ["不正署名", "channel-secret", "signature", 401],
  ])("%sを拒否する", async (_label, secret, signature, expectedStatus) => {
    if (secret === undefined) delete process.env.LINE_MESSAGING_CHANNEL_SECRET;
    const ctx = createActionCtx();
    const verifySignature = vi.fn().mockResolvedValue(false);
    const handler = createLineWebhookHandler(verifySignature);

    const response = (await asAny(handler)(ctx, createRequest("{}", signature))) as MockResponse;

    expect(response.status).toBe(expectedStatus);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it.each(["not-json", JSON.stringify({ events: [{ type: "follow" }] })])(
    "署名済みでも不正payloadを拒否する: %s",
    async (rawBody) => {
      const ctx = createActionCtx();
      const handler = createLineWebhookHandler(vi.fn().mockResolvedValue(true));

      const response = (await asAny(handler)(ctx, createRequest(rawBody))) as MockResponse;

      expect(response.status).toBe(400);
      expect(ctx.runMutation).not.toHaveBeenCalled();
    },
  );

  it("大きすぎるraw bodyを署名検証前に拒否する", async () => {
    const ctx = createActionCtx();
    const verifySignature = vi.fn().mockResolvedValue(true);
    const handler = createLineWebhookHandler(verifySignature);
    const rawBody = "x".repeat(MAX_RAW_BODY_BYTES + 1);

    const response = (await asAny(handler)(ctx, createRequest(rawBody))) as MockResponse;

    expect(response.status).toBe(413);
    expect(verifySignature).not.toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
