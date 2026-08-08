export const accountDeletionActiveStatuses = [
  "requested",
  "preparing_groups",
  "purging_groups",
  "deleting_identity",
  "retry_wait",
  "identity_deleted",
  "finalization_retry_wait",
  "failed",
] as const;

export type AccountDeletionActiveStatus = (typeof accountDeletionActiveStatuses)[number];

export function isActiveAccountDeletionStatus(
  status: string,
): status is AccountDeletionActiveStatus {
  return (accountDeletionActiveStatuses as readonly string[]).includes(status);
}

export function isAccountDeletionFinalizableStatus(status: string): boolean {
  return status === "identity_deleted" || status === "finalization_retry_wait";
}
