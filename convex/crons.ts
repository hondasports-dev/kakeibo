import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup email records",
  { hours: 24 },
  internal.email.cleanup.cleanupOldEmailRecords,
  {},
);

crons.interval(
  "cleanup LINE webhook events",
  { hours: 24 },
  internal.lineWebhook.cleanup.cleanupOldEvents,
  {},
);

crons.interval(
  "cleanup completed account deletion requests",
  { hours: 24 },
  internal.accountDeletion.cleanupCompletedRequests,
  {},
);

export default crons;
