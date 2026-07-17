import { describe, expect, it } from "vitest";
import schema from "../../schema";
import { GROUP_DELETION_PURGE_TABLES } from "./groupDeletionRegistry";

function getSchemaGroupScopedTables() {
  return Object.entries(schema.tables)
    .filter(([, table]) => {
      const groupId =
        table.validator.kind === "object" ? table.validator.fields.groupId : undefined;
      return groupId?.kind === "id" && groupId.tableName === "groups";
    })
    .map(([tableName]) => tableName)
    .sort();
}

describe("group deletion registry", () => {
  it("schema の groupId を持つ全tableをpurge対象として分類する", () => {
    expect([...GROUP_DELETION_PURGE_TABLES].sort()).toEqual(getSchemaGroupScopedTables());
  });

  it("参照関係を壊さない順序で削除する", () => {
    expect(GROUP_DELETION_PURGE_TABLES).toEqual([
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
    ]);
  });
});
