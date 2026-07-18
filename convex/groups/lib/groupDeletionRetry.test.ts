import { describe, expect, it } from "vitest";
import { planGroupDeletionRetry } from "./groupDeletionRetry";

describe("planGroupDeletionRetry", () => {
  it("再試行上限までは段階的なbackoffを返す", () => {
    expect(planGroupDeletionRetry({ attemptCount: 0, maxAttempts: 6, now: 1_000 })).toEqual({
      status: "retry_wait",
      attemptCount: 1,
      delayMs: 60_000,
      nextRetryAt: 61_000,
    });
    expect(planGroupDeletionRetry({ attemptCount: 4, maxAttempts: 6, now: 1_000 })).toEqual({
      status: "retry_wait",
      attemptCount: 5,
      delayMs: 21_600_000,
      nextRetryAt: 21_601_000,
    });
  });

  it("再試行上限に達したら自動scheduleしないfailedを返す", () => {
    expect(planGroupDeletionRetry({ attemptCount: 5, maxAttempts: 6, now: 1_000 })).toEqual({
      status: "failed",
      attemptCount: 6,
    });
  });
});
