// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";
import { LINE_WEBHOOK_EVENT_RETENTION_DAYS } from "./cleanup";

describe("LINE webhook event cleanup", () => {
  it("保持期間を超えたイベントだけを削除する", async () => {
    const t = convexTest(schema, convexTestModules);
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    await t.run(async (ctx) => {
      await ctx.db.insert("lineWebhookEvents", {
        webhookEventId: "old-event",
        eventType: "text",
        delivery: "linked",
        userId: "user-old",
        messageText: "old",
        createdAt: now - (LINE_WEBHOOK_EVENT_RETENTION_DAYS + 1) * day,
      });
      await ctx.db.insert("lineWebhookEvents", {
        webhookEventId: "fresh-event",
        eventType: "text",
        delivery: "linked",
        userId: "user-fresh",
        messageText: "fresh",
        createdAt: now,
      });
    });

    await t.mutation(internal.lineWebhook.cleanup.cleanupOldEvents, {});

    await expect(
      t.run(async (ctx) => ctx.db.query("lineWebhookEvents").withIndex("by_created_at").collect()),
    ).resolves.toMatchObject([{ webhookEventId: "fresh-event" }]);
  });
});
