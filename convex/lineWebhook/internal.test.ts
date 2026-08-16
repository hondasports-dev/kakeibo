// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";

const linkedEvent = {
  webhookEventId: "event-linked",
  eventType: "text" as const,
  lineUserId: "line-user-linked",
  messageId: "message-private",
  messageText: "今週の支出",
  replyToken: "reply-token-private",
};

describe("LINE webhook event claim", () => {
  it("active linkのあるイベントだけをkakeibo userへ解決し、allowlistを保存する", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      await ctx.db.insert("lineAccountLinks", {
        userId: "kakeibo-user",
        lineUserId: "line-user-linked",
        status: "active",
        linkedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await expect(
      t.mutation(internal.lineWebhook.internal.claimEvents, { events: [linkedEvent] }),
    ).resolves.toEqual({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 0,
      scheduledSummaryCount: 1,
    });

    const events = await t.run(async (ctx) => ctx.db.query("lineWebhookEvents").collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      webhookEventId: "event-linked",
      eventType: "text",
      delivery: "linked",
      userId: "kakeibo-user",
      messageId: "message-private",
      messageText: "今週の支出",
    });
    expect(JSON.stringify(events)).not.toContain("line-user-linked");
    expect(JSON.stringify(events)).not.toContain("reply-token-private");
  });

  it("未連携イベントは家計データを保存せず案内replyだけを返す", async () => {
    const t = convexTest(schema, convexTestModules);

    await expect(
      t.mutation(internal.lineWebhook.internal.claimEvents, {
        events: [
          {
            ...linkedEvent,
            webhookEventId: "event-unlinked",
            lineUserId: "line-user-unlinked",
          },
        ],
      }),
    ).resolves.toEqual({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 1,
      scheduledSummaryCount: 0,
    });

    const events = await t.run(async (ctx) => ctx.db.query("lineWebhookEvents").collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      webhookEventId: "event-unlinked",
      eventType: "text",
      delivery: "unlinked",
    });
    expect(events[0]?.userId).toBeUndefined();
    expect(events[0]?.messageText).toBeUndefined();
  });

  it("同じwebhookEventIdは再送しても保存・案内を重複させない", async () => {
    const t = convexTest(schema, convexTestModules);
    const first = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [{ ...linkedEvent, lineUserId: "line-user-unlinked" }],
    });
    const second = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [{ ...linkedEvent, lineUserId: "line-user-unlinked" }],
    });

    expect(first).toEqual({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 1,
      scheduledSummaryCount: 0,
    });
    expect(second).toEqual({
      claimedCount: 0,
      duplicateCount: 1,
      scheduledGuideCount: 0,
      scheduledSummaryCount: 0,
    });
    await expect(
      t.run(async (ctx) => ctx.db.query("lineWebhookEvents").collect()),
    ).resolves.toHaveLength(1);
  });

  it("同一payload内のwebhookEventId重複は1件だけclaim・案内予約する", async () => {
    const t = convexTest(schema, convexTestModules);

    await expect(
      t.mutation(internal.lineWebhook.internal.claimEvents, {
        events: [
          {
            ...linkedEvent,
            webhookEventId: "event-batch-duplicate",
            lineUserId: "line-user-unlinked",
          },
          {
            ...linkedEvent,
            webhookEventId: "event-batch-duplicate",
            lineUserId: "line-user-unlinked",
          },
        ],
      }),
    ).resolves.toEqual({
      claimedCount: 1,
      duplicateCount: 1,
      scheduledGuideCount: 1,
      scheduledSummaryCount: 0,
    });

    await expect(
      t.run(async (ctx) => ctx.db.query("lineWebhookEvents").collect()),
    ).resolves.toHaveLength(1);
  });

  it("解除済みlinkは未連携として扱う", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      await ctx.db.insert("lineAccountLinks", {
        userId: "kakeibo-user",
        lineUserId: "line-user-revoked",
        status: "revoked",
        linkedAt: 1,
        revokedAt: 2,
        createdAt: 1,
        updatedAt: 2,
      });
    });

    await expect(
      t.mutation(internal.lineWebhook.internal.claimEvents, {
        events: [
          { ...linkedEvent, webhookEventId: "event-revoked", lineUserId: "line-user-revoked" },
        ],
      }),
    ).resolves.toMatchObject({ claimedCount: 1, scheduledGuideCount: 1 });
  });

  it("同じLINE userに異なるactive userが残る不整合時は解決せず案内へ回す", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      for (const userId of ["kakeibo-user-a", "kakeibo-user-b"]) {
        await ctx.db.insert("lineAccountLinks", {
          userId,
          lineUserId: "line-user-conflict",
          status: "active",
          linkedAt: 1,
          createdAt: 1,
          updatedAt: 1,
        });
      }
    });

    await expect(
      t.mutation(internal.lineWebhook.internal.claimEvents, {
        events: [
          {
            ...linkedEvent,
            webhookEventId: "event-conflict",
            lineUserId: "line-user-conflict",
          },
        ],
      }),
    ).resolves.toMatchObject({ claimedCount: 1, scheduledGuideCount: 1 });
    const [event] = await t.run(async (ctx) => ctx.db.query("lineWebhookEvents").collect());
    expect(event?.userId).toBeUndefined();
  });

  it("連携済みのtextだけサマリー返信を予約し、followや再送では予約しない", async () => {
    const t = convexTest(schema, convexTestModules);
    await t.run(async (ctx) => {
      await ctx.db.insert("lineAccountLinks", {
        userId: "kakeibo-user",
        lineUserId: "line-user-linked",
        status: "active",
        linkedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
    });

    const follow = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-follow-linked",
          eventType: "follow",
          lineUserId: "line-user-linked",
          replyToken: "reply-token-follow",
        },
      ],
    });
    const firstText = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [linkedEvent],
    });
    const replayText = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [linkedEvent],
    });

    expect(follow).toMatchObject({ scheduledSummaryCount: 0, scheduledGuideCount: 0 });
    expect(firstText).toMatchObject({ scheduledSummaryCount: 1, scheduledGuideCount: 0 });
    expect(replayText).toMatchObject({
      claimedCount: 0,
      duplicateCount: 1,
      scheduledSummaryCount: 0,
    });
  });
});
