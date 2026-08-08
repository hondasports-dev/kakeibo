export const accountDeletionRetryDelaysMs = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
] as const;

export function getAccountDeletionRetryDelay(attemptIndex: number): number {
  return accountDeletionRetryDelaysMs[
    Math.min(attemptIndex, accountDeletionRetryDelaysMs.length - 1)
  ];
}
