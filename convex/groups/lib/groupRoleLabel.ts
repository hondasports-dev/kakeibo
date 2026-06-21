import type { GroupAdminRole } from "../adminGuards";

export function formatGroupRoleLabel(role: GroupAdminRole): string {
  return role === "owner" ? "オーナー" : "メンバー";
}
