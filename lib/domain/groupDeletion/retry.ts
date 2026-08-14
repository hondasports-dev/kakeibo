import { calculateRetryDelayMs } from "../common/retry";

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

export type { RetryPlan };

export function planGroupDeletionRetry(args: {
  attemptCount: number;
  maxAttempts: number;
  now: number;
}): RetryPlan {
  const attemptCount = args.attemptCount + 1;
  if (attemptCount >= args.maxAttempts) {
    return { status: "failed", attemptCount };
  }

  const delayMs = calculateRetryDelayMs(attemptCount);
  if (delayMs === null) {
    return { status: "failed", attemptCount };
  }

  return {
    status: "retry_wait",
    attemptCount,
    delayMs,
    nextRetryAt: args.now + delayMs,
  };
}
