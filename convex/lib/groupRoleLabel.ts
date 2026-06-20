import type { GroupAdminRole } from "../groupAdminGuards";

export function formatGroupRoleLabel(role: GroupAdminRole): string {
  return role === "owner" ? "オーナー" : "メンバー";
}
