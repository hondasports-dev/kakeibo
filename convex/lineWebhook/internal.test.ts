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
      scheduledImageCount: 0,
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
      scheduledImageCount: 0,
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
      scheduledImageCount: 0,
    });
    expect(second).toEqual({
      claimedCount: 0,
      duplicateCount: 1,
      scheduledGuideCount: 0,
      scheduledSummaryCount: 0,
      scheduledImageCount: 0,
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
      scheduledImageCount: 0,
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

  it("連携済みのtextとpostbackはサマリー返信を予約し、followや再送では予約しない", async () => {
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
    const weekSummaryPostback = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-postback-week-summary",
          eventType: "postback",
          lineUserId: "line-user-linked",
          replyToken: "reply-token-postback",
          postbackData: "week_summary",
        },
      ],
    });
    const weekTextPostback = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-postback-week-text",
          eventType: "postback",
          lineUserId: "line-user-linked",
          replyToken: "reply-token-postback-text",
          postbackData: "今週",
        },
      ],
    });
    const unknownPostback = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-postback-unknown",
          eventType: "postback",
          lineUserId: "line-user-linked",
          replyToken: "reply-token-postback-unknown",
          postbackData: "action=summary",
        },
      ],
    });
    const postbackWithoutToken = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-postback-no-token",
          eventType: "postback",
          lineUserId: "line-user-linked",
          postbackData: "week_summary",
        },
      ],
    });
    const replayPostback = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-postback-week-summary",
          eventType: "postback",
          lineUserId: "line-user-linked",
          replyToken: "reply-token-postback",
          postbackData: "week_summary",
        },
      ],
    });

    expect(follow).toMatchObject({
      scheduledSummaryCount: 0,
      scheduledGuideCount: 0,
      scheduledImageCount: 0,
    });
    expect(firstText).toMatchObject({
      scheduledSummaryCount: 1,
      scheduledGuideCount: 0,
      scheduledImageCount: 0,
    });
    expect(replayText).toMatchObject({
      claimedCount: 0,
      duplicateCount: 1,
      scheduledSummaryCount: 0,
      scheduledImageCount: 0,
    });
    expect(weekSummaryPostback).toMatchObject({
      scheduledSummaryCount: 1,
      scheduledGuideCount: 0,
      scheduledImageCount: 0,
    });
    expect(weekTextPostback).toMatchObject({ scheduledSummaryCount: 1 });
    expect(unknownPostback).toMatchObject({ scheduledSummaryCount: 1 });
    expect(postbackWithoutToken).toMatchObject({ scheduledSummaryCount: 0 });
    expect(replayPostback).toMatchObject({
      claimedCount: 0,
      duplicateCount: 1,
      scheduledSummaryCount: 0,
    });
  });

  it("未連携postbackは案内だけを予約し家計サマリーは予約しない", async () => {
    const t = convexTest(schema, convexTestModules);

    await expect(
      t.mutation(internal.lineWebhook.internal.claimEvents, {
        events: [
          {
            webhookEventId: "event-postback-unlinked",
            eventType: "postback",
            lineUserId: "line-user-unlinked",
            replyToken: "reply-token-unlinked",
            postbackData: "week_summary",
          },
        ],
      }),
    ).resolves.toEqual({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 1,
      scheduledSummaryCount: 0,
      scheduledImageCount: 0,
    });
  });

  it("連携済みimageはサマリーではなく画像ジョブを予約し、未連携imageは取得も保存もしない", async () => {
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

    const linkedImage = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-image-linked",
          eventType: "image",
          lineUserId: "line-user-linked",
          messageId: "message-image-linked",
          replyToken: "reply-token-image",
        },
      ],
    });
    const unlinkedImage = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-image-unlinked",
          eventType: "image",
          lineUserId: "line-user-unlinked",
          messageId: "message-image-unlinked",
          replyToken: "reply-token-unlinked",
        },
      ],
    });
    const replayLinked = await t.mutation(internal.lineWebhook.internal.claimEvents, {
      events: [
        {
          webhookEventId: "event-image-linked",
          eventType: "image",
          lineUserId: "line-user-linked",
          messageId: "message-image-linked",
          replyToken: "reply-token-image",
        },
      ],
    });

    expect(linkedImage).toEqual({
      claimedCount: 1,
      duplicateCount: 0,
      scheduledGuideCount: 0,
      scheduledSummaryCount: 0,
      scheduledImageCount: 1,
    });
    expect(unlinkedImage).toMatchObject({
      scheduledGuideCount: 1,
      scheduledSummaryCount: 0,
      scheduledImageCount: 0,
    });
    expect(replayLinked).toMatchObject({
      claimedCount: 0,
      duplicateCount: 1,
      scheduledImageCount: 0,
    });

    const state = await t.run(async (ctx) => ({
      events: await ctx.db.query("lineWebhookEvents").collect(),
      jobs: await ctx.db.query("lineImageJobs").collect(),
    }));
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({
      webhookEventId: "event-image-linked",
      userId: "kakeibo-user",
      messageId: "message-image-linked",
      status: "pending",
    });
    const unlinkedEvent = state.events.find(
      (event) => event.webhookEventId === "event-image-unlinked",
    );
    expect(unlinkedEvent).toMatchObject({ delivery: "unlinked" });
    expect(unlinkedEvent?.userId).toBeUndefined();
    expect(unlinkedEvent?.messageId).toBeUndefined();
    expect(JSON.stringify(state)).not.toContain("line-user-");
    expect(JSON.stringify(state)).not.toContain("reply-token");
    expect(JSON.stringify(state)).not.toContain("data:image");
  });
});
