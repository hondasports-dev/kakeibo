import { v } from "convex/values";

export const groupDeletionSourceValidator = v.union(
  v.literal("owner"),
  v.literal("account_deletion"),
  v.literal("e2e_cleanup"),
);

export const groupDeletionStatusValidator = v.union(
  v.literal("requested"),
  v.literal("running"),
  v.literal("retry_wait"),
  v.literal("failed"),
  v.literal("completed"),
);

export const groupDeletionStageValidator = v.union(
  v.literal("receiptAnalysisImageJobs"),
  v.literal("aiExpenseDraftItems"),
  v.literal("aiExpenseDrafts"),
  v.literal("receiptAnalysisBatches"),
  v.literal("expenseEntries"),
  v.literal("receipts"),
  v.literal("sourceDocuments"),
  v.literal("weekSessions"),
  v.literal("categories"),
  v.literal("groupInvitations"),
  v.literal("managementAuditLogs"),
  v.literal("groupMembers"),
  v.literal("finalSweep"),
);

export const groupDeletionCountsValidator = v.object({
  receiptAnalysisImageJobs: v.number(),
  aiExpenseDraftItems: v.number(),
  aiExpenseDrafts: v.number(),
  receiptAnalysisBatches: v.number(),
  expenseEntries: v.number(),
  receipts: v.number(),
  sourceDocuments: v.number(),
  storageFiles: v.number(),
  weekSessions: v.number(),
  categories: v.number(),
  groupInvitations: v.number(),
  managementAuditLogs: v.number(),
  groupMembers: v.number(),
  groups: v.number(),
});

export type GroupDeletionStatus = "requested" | "running" | "retry_wait" | "failed" | "completed";

export type GroupDeletionStage =
  | "receiptAnalysisImageJobs"
  | "aiExpenseDraftItems"
  | "aiExpenseDrafts"
  | "receiptAnalysisBatches"
  | "expenseEntries"
  | "receipts"
  | "sourceDocuments"
  | "weekSessions"
  | "categories"
  | "groupInvitations"
  | "managementAuditLogs"
  | "groupMembers"
  | "finalSweep";
