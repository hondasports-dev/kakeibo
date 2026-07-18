const RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  6 * 60 * 60_000,
] as const;

type RetryPlan =
  | {
      status: "retry_wait";
      attemptCount: number;
      delayMs: number;
      nextRetryAt: number;
    }
  | {
      status: "failed";
      attemptCount: number;
    };

export function planGroupDeletionRetry(args: {
  attemptCount: number;
  maxAttempts: number;
  now: number;
}): RetryPlan {
  const attemptCount = args.attemptCount + 1;
  if (attemptCount >= args.maxAttempts) {
    return { status: "failed", attemptCount };
  }

  const delayMs = RETRY_DELAYS_MS[Math.min(attemptCount - 1, RETRY_DELAYS_MS.length - 1)];
  return {
    status: "retry_wait",
    attemptCount,
    delayMs,
    nextRetryAt: args.now + delayMs,
  };
}
