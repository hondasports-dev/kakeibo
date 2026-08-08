export const DEFAULT_RETRY_DELAYS_MS = [
  60 * 1000, // 1m
  5 * 60 * 1000, // 5m
  30 * 60 * 1000, // 30m
  2 * 60 * 60 * 1000, // 2h
  6 * 60 * 60 * 1000, // 6h
] as const;

export const DEFAULT_MAX_RETRY_ATTEMPTS = 6;

export function calculateRetryDelayMs(attemptCount: number): number | null {
  if (attemptCount >= DEFAULT_MAX_RETRY_ATTEMPTS || attemptCount < 1) {
    return null;
  }
  return DEFAULT_RETRY_DELAYS_MS[attemptCount - 1] ?? null;
}

export function isMaxRetryAttemptsReached(attemptCount: number): boolean {
  return attemptCount >= DEFAULT_MAX_RETRY_ATTEMPTS;
}
