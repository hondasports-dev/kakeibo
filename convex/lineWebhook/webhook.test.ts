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
  mutationResult = {
    claimedCount: 1,
    duplicateCount: 0,
    scheduledGuideCount: 0,
    scheduledSummaryCount: 0,
    scheduledImageCount: 0,
  },
) {
  return {
    runMutation: vi.fn().mockResolvedValue(mutationResult),
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
  };
}

function createRequest(
  body: string,
  signature: string | null = "signature",
  options: { chunks?: Uint8Array[]; onRead?: () => void; onCancel?: () => void } = {},
) {
  const bytes = new TextEncoder().encode(body);
  const chunks = options.chunks ?? [bytes];
  let chunkIndex = 0;
  return {
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        options.onRead?.();
        const chunk = chunks[chunkIndex++];
        if (chunk) controller.enqueue(chunk);
        else controller.close();
      },
      cancel() {
        options.onCancel?.();
      },
    }),
    headers: { get: (name: string) => (name === "x-line-signature" ? signature : null) },
  };
}

describe("LINE webhook HTTP handler", () => {
  beforeEach(() => {
    process.env.LINE_MESSAGING_CHANNEL_SECRET = "channel-secret";
    (globalThis as any).Response = MockResponse;
  });

  it("署名検証後にraw payloadを正規化してclaim mutationを実行する", async () => {
    const verifySignature = vi.fn().mockResolvedValue(true);
    const ctx = createActionCtx({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 1,
      scheduledSummaryCount: 0,
      scheduledImageCount: 0,
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
    const handler = createLineWebhookHandler(verifySignature);

    const response = (await asAny(handler)(ctx, createRequest(rawBody))) as MockResponse;

    expect(response.status).toBe(200);
    expect(verifySignature).toHaveBeenCalledTimes(1);
    const [receivedBody, receivedSignature, receivedSecret] = verifySignature.mock.calls[0] as [
      Uint8Array,
      string,
      string,
    ];
    expect(Array.from(receivedBody)).toEqual(Array.from(new TextEncoder().encode(rawBody)));
    expect(receivedSignature).toBe("signature");
    expect(receivedSecret).toBe("channel-secret");
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
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
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
    const firstChunk = new Uint8Array(MAX_RAW_BODY_BYTES - 1);
    const secondChunk = new Uint8Array(2);
    let readCount = 0;
    let cancelled = false;

    const response = (await asAny(handler)(
      ctx,
      createRequest("", "signature", {
        chunks: [firstChunk, secondChunk, new Uint8Array([1])],
        onRead: () => {
          readCount += 1;
        },
        onCancel: () => {
          cancelled = true;
        },
      }),
    )) as MockResponse;

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(readCount).toBeLessThan(3);
    expect(verifySignature).not.toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("text fixtureの今週の支出メッセージを正規化してclaimへ渡す", async () => {
    const rawBody = JSON.stringify({
      events: [
        {
          type: "message",
          webhookEventId: "event-text-summary",
          timestamp: 1_700_000_000_000,
          source: { type: "user", userId: "line-user-private" },
          replyToken: "reply-token-private",
          message: { type: "text", id: "message-1", text: "今週の支出" },
        },
      ],
    });
    const ctx = createActionCtx({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 0,
      scheduledSummaryCount: 1,
      scheduledImageCount: 0,
    });
    const handler = createLineWebhookHandler(vi.fn().mockResolvedValue(true));

    const response = (await asAny(handler)(ctx, createRequest(rawBody))) as MockResponse;

    expect(response.status).toBe(200);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        events: [
          expect.objectContaining({
            webhookEventId: "event-text-summary",
            eventType: "text",
            messageText: "今週の支出",
            lineUserId: "line-user-private",
          }),
        ],
      }),
    );
  });

  it("image fixtureを正規化してclaimへ渡す", async () => {
    const rawBody = JSON.stringify({
      events: [
        {
          type: "message",
          webhookEventId: "event-image-receipt",
          timestamp: 1_700_000_000_000,
          source: { type: "user", userId: "line-user-private" },
          replyToken: "reply-token-private",
          message: { type: "image", id: "message-image-1" },
        },
      ],
    });
    const ctx = createActionCtx({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 0,
      scheduledSummaryCount: 0,
      scheduledImageCount: 1,
    });
    const handler = createLineWebhookHandler(vi.fn().mockResolvedValue(true));

    const response = (await asAny(handler)(ctx, createRequest(rawBody))) as MockResponse;

    expect(response.status).toBe(200);
    expect(ctx.runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        events: [
          expect.objectContaining({
            webhookEventId: "event-image-receipt",
            eventType: "image",
            messageId: "message-image-1",
            lineUserId: "line-user-private",
          }),
        ],
      }),
    );
    expect(JSON.stringify(ctx.runMutation.mock.calls[0]?.[1])).not.toContain("image/");
  });
});
