import { v } from "convex/values";

export const managementAuditActionValidator = v.union(
  v.literal("group_name_changed"),
  v.literal("member_removed"),
  v.literal("invitation_revoked"),
  v.literal("member_role_changed"),
  v.literal("owner_transferred"),
  v.literal("group_archived"),
  v.literal("group_deleted"),
  v.literal("system_admin_granted"),
  v.literal("system_admin_revoked"),
  v.literal("system_admin_delegated"),
);

export type ManagementAuditAction =
  | "group_name_changed"
  | "member_removed"
  | "invitation_revoked"
  | "member_role_changed"
  | "owner_transferred"
  | "group_archived"
  | "group_deleted"
  | "system_admin_granted"
  | "system_admin_revoked"
  | "system_admin_delegated";

export const managementAuditTargetKindValidator = v.union(
  v.literal("group"),
  v.literal("member"),
  v.literal("invitation"),
);

export type ManagementAuditTargetKind = "group" | "member" | "invitation";

export const MANAGEMENT_AUDIT_ACTION_LABELS: Record<ManagementAuditAction, string> = {
  group_name_changed: "グループ名を変更",
  member_removed: "メンバーをグループから外す",
  invitation_revoked: "招待を取り消す",
  member_role_changed: "メンバーのロールを変更",
  owner_transferred: "オーナー権限を譲渡",
  group_archived: "グループをアーカイブ",
  group_deleted: "グループを削除",
  system_admin_granted: "システム管理者権限を付与",
  system_admin_revoked: "システム管理者権限を剥奪",
  system_admin_delegated: "システム管理者による操作代行",
};

export const managementAuditLogListItemValidator = v.object({
  _id: v.id("managementAuditLogs"),
  action: managementAuditActionValidator,
  actionLabel: v.string(),
  actorDisplayName: v.string(),
  targetLabel: v.union(v.string(), v.null()),
  beforeValue: v.union(v.string(), v.null()),
  afterValue: v.union(v.string(), v.null()),
  createdAt: v.number(),
});
