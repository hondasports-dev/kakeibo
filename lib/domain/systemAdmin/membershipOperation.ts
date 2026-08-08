export type MembershipOperation = "add" | "remove" | "transfer" | "set_active" | "clear_active";

export type ValidateMembershipOperationShapeError = "invalid_shape" | "same_source_target";

export function validateMembershipOperationShape(
  operation: MembershipOperation,
  sourceGroupId: string | undefined,
  targetGroupId: string | undefined,
): { success: true } | { success: false; error: ValidateMembershipOperationShapeError } {
  const valid =
    (operation === "add" && !sourceGroupId && !!targetGroupId) ||
    (operation === "remove" && !!sourceGroupId && !targetGroupId) ||
    (operation === "transfer" && !!sourceGroupId && !!targetGroupId) ||
    (operation === "set_active" && !sourceGroupId && !!targetGroupId) ||
    (operation === "clear_active" && !sourceGroupId && !targetGroupId);
  if (!valid) {
    return { success: false, error: "invalid_shape" };
  }
  if (sourceGroupId && targetGroupId && sourceGroupId === targetGroupId) {
    return { success: false, error: "same_source_target" };
  }
  return { success: true };
}
