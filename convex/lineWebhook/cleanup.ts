import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

export const LINE_WEBHOOK_EVENT_RETENTION_DAYS = 30;
const CLEANUP_BATCH_SIZE = 100;

export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - LINE_WEBHOOK_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const events = await ctx.db
      .query("lineWebhookEvents")
      .withIndex("by_created_at", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_BATCH_SIZE);

    for (const event of events) await ctx.db.delete(event._id);

    if (events.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.lineWebhook.cleanup.cleanupOldEvents, {});
      return;
    }

    const jobs = await ctx.db
      .query("lineImageJobs")
      .withIndex("by_created_at", (q) => q.lt("createdAt", cutoff))
      .take(CLEANUP_BATCH_SIZE);

    for (const job of jobs) await ctx.db.delete(job._id);

    if (jobs.length === CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.lineWebhook.cleanup.cleanupOldEvents, {});
    }
  },
});
