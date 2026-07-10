export const RETRY_DELAYS_MS = [
  60 * 1000, // 1m
  5 * 60 * 1000, // 5m
  30 * 60 * 1000, // 30m
  2 * 60 * 60 * 1000, // 2h
  6 * 60 * 60 * 1000, // 6h
] as const;

export const MAX_ATTEMPTS = 6;

export function getRetryDelayMs(attemptCount: number): number | null {
  if (attemptCount >= MAX_ATTEMPTS) {
    return null;
  }
  const delay = RETRY_DELAYS_MS[attemptCount - 1];
  return delay ?? null;
}

export function isMaxAttemptsReached(attemptCount: number): boolean {
  return attemptCount >= MAX_ATTEMPTS;
}
