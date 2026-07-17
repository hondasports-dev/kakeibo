/**
 * グループ物理削除の依存順。
 * groupId を持つtableを追加した場合、schema同期testが未分類を検出する。
 */
export const GROUP_DELETION_PURGE_TABLES = [
  "receiptAnalysisImageJobs",
  "aiExpenseDraftItems",
  "aiExpenseDrafts",
  "receiptAnalysisBatches",
  "expenseEntries",
  "receipts",
  "sourceDocuments",
  "weekSessions",
  "categories",
  "groupInvitations",
  "managementAuditLogs",
  "groupMembers",
] as const;

export type GroupDeletionPurgeTable = (typeof GROUP_DELETION_PURGE_TABLES)[number];
