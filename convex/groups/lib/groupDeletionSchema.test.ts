import { describe, expect, it } from "vitest";
import schema from "../../schema";

describe("groupDeletionJobs schema", () => {
  it("削除後も残すgroup識別子をforeign keyではなくsnapshotとして保持する", () => {
    const table = schema.tables.groupDeletionJobs;

    expect(table).toBeDefined();
    expect(table.validator.kind).toBe("object");
    if (table.validator.kind !== "object") return;

    expect(table.validator.fields.targetGroupIdSnapshot).toMatchObject({ kind: "string" });
    expect(table.validator.fields.targetGroupNameSnapshot).toMatchObject({ kind: "string" });
    expect("groupId" in table.validator.fields).toBe(false);
  });

  it("未完了jobと運用一覧をbounded indexで取得できる", () => {
    const table = schema.tables.groupDeletionJobs;
    const indexes = table[" indexes"]().map((index) => index.indexDescriptor);

    expect(indexes).toEqual(
      expect.arrayContaining([
        "by_target_group_id_snapshot_and_is_active",
        "by_status_and_updated_at",
      ]),
    );
  });
});
