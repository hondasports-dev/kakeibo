import type { GroupAdminRole } from "../groups/adminGuards";

export function formatGroupRoleLabel(role: GroupAdminRole): string {
  return role === "owner" ? "オーナー" : "メンバー";
}
