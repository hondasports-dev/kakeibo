import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";

const TERMINAL_STATUSES = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "suppressed",
  "failed",
] as const;

const CLEANUP_BATCH_SIZE = 100;
const RETENTION_DAYS = 30;

export const cleanupOldEmailRecords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - RETENTION_DAYS * 24 * 60 * 60 * 1000;

    let deletedJobCount = 0;
    for (const status of TERMINAL_STATUSES) {
      const jobs = await ctx.db
        .query("transactionalEmailJobs")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", status).lt("updatedAt", cutoff),
        )
        .take(CLEANUP_BATCH_SIZE);
      for (const job of jobs) {
        await ctx.db.delete(job._id);
        deletedJobCount++;
      }
    }

    const events = await ctx.db
      .query("emailWebhookEvents")
      .withIndex("by_processed_at", (q) => q.lt("processedAt", cutoff))
      .take(CLEANUP_BATCH_SIZE);
    for (const event of events) {
      await ctx.db.delete(event._id);
    }

    if (deletedJobCount >= CLEANUP_BATCH_SIZE || events.length >= CLEANUP_BATCH_SIZE) {
      await ctx.scheduler.runAfter(0, internal.email.cleanup.cleanupOldEmailRecords, {});
    }
  },
});
