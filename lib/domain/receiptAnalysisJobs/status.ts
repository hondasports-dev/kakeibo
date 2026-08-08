export const TERMINAL_IMAGE_JOB_STATUSES = new Set([
  "ready",
  "needs_review",
  "failed",
  "cancelled",
]);

export function isTerminalImageJobStatus(status: string): boolean {
  return TERMINAL_IMAGE_JOB_STATUSES.has(status);
}
