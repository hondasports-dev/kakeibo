export const MAX_REASON_LENGTH = 500;

export type NormalizeReasonError = "empty" | "too_long";

export function normalizeSystemAdminReason(
  reason: string,
): { success: true; reason: string } | { success: false; error: NormalizeReasonError } {
  const normalized = reason.trim();
  if (normalized.length < 1) {
    return { success: false, error: "empty" };
  }
  if (normalized.length > MAX_REASON_LENGTH) {
    return { success: false, error: "too_long" };
  }
  return { success: true, reason: normalized };
}
