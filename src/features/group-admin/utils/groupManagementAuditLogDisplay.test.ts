import { describe, expect, it } from "vitest";
import {
  getManagementAuditLogDetailLabel,
  type GroupManagementAuditLogListItem,
} from "./groupManagementAuditLogDisplay";

describe("getManagementAuditLogDetailLabel", () => {
  it("グループ名変更は before/after を表示する", () => {
    const log: GroupManagementAuditLogListItem = {
      _id: "log-001",
      action: "group_name_changed",
      actionLabel: "グループ名を変更",
      actorDisplayName: "オーナー",
      targetLabel: "佐藤家",
      beforeValue: "佐藤家",
      afterValue: "鈴木家",
      createdAt: 1000,
    };

    expect(getManagementAuditLogDetailLabel(log)).toBe("佐藤家 → 鈴木家");
  });

  it("ロール変更は before/after を表示する", () => {
    const log: GroupManagementAuditLogListItem = {
      _id: "log-003",
      action: "member_role_changed",
      actionLabel: "メンバーのロールを変更",
      actorDisplayName: "オーナー",
      targetLabel: "メンバーA",
      beforeValue: "メンバー",
      afterValue: "オーナー",
      createdAt: 1000,
    };

    expect(getManagementAuditLogDetailLabel(log)).toBe("メンバー → オーナー");
  });

  it("対象ラベルがある場合はそれを表示する", () => {
    const log: GroupManagementAuditLogListItem = {
      _id: "log-002",
      action: "member_removed",
      actionLabel: "メンバーをグループから外す",
      actorDisplayName: "オーナー",
      targetLabel: "メンバーA",
      beforeValue: null,
      afterValue: null,
      createdAt: 1000,
    };

    expect(getManagementAuditLogDetailLabel(log)).toBe("メンバーA");
  });
});
