import { describe, it, expect } from "vitest";
import { getRetryDelayMs, isMaxAttemptsReached, RETRY_DELAYS_MS } from "./retryPolicy";

describe("retryPolicy", () => {
  it("returns delays for attempts 1..5", () => {
    expect(getRetryDelayMs(1)).toBe(RETRY_DELAYS_MS[0]);
    expect(getRetryDelayMs(2)).toBe(RETRY_DELAYS_MS[1]);
    expect(getRetryDelayMs(3)).toBe(RETRY_DELAYS_MS[2]);
    expect(getRetryDelayMs(4)).toBe(RETRY_DELAYS_MS[3]);
    expect(getRetryDelayMs(5)).toBe(RETRY_DELAYS_MS[4]);
  });

  it("returns null for attempt 6 (max)", () => {
    expect(getRetryDelayMs(6)).toBeNull();
  });

  it("returns null for attempts beyond max", () => {
    expect(getRetryDelayMs(7)).toBeNull();
  });

  it("detects max attempts", () => {
    expect(isMaxAttemptsReached(5)).toBe(false);
    expect(isMaxAttemptsReached(6)).toBe(true);
    expect(isMaxAttemptsReached(10)).toBe(true);
  });
});
