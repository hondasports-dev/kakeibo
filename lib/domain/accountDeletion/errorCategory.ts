export function getAccountDeletionErrorCategory(
  status: string,
  lastErrorCode?: string,
): string | null {
  if (status === "failed") {
    return lastErrorCode ?? "identity_deletion_failed";
  }
  return null;
}
