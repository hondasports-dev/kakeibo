/**
 * グループ内ロールに関するドメインルール。
 * UI / Convex の両方から利用できる純粋関数のみを含む。
 */

/** グループ内ロール。 */
export type GroupRole = "owner" | "member";

/** ロールの人間可読ラベルを返す。 */
export function formatGroupRoleLabel(role: GroupRole): string {
  return role === "owner" ? "オーナー" : "メンバー";
}
