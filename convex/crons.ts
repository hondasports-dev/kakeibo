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
  "cleanup completed account deletion requests",
  { hours: 24 },
  internal.accountDeletion.cleanupCompletedRequests,
  {},
);

export default crons;
