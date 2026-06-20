export type GroupRole = "owner" | "member";

export function formatGroupRoleLabel(role: GroupRole): string {
  return role === "owner" ? "オーナー" : "メンバー";
}
