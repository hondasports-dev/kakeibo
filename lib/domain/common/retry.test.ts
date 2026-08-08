import { describe, expect, it } from "vitest";
import {
  calculateRetryDelayMs,
  DEFAULT_MAX_RETRY_ATTEMPTS,
  DEFAULT_RETRY_DELAYS_MS,
  isMaxRetryAttemptsReached,
} from "./retry";

describe("retry helpers", () => {
  it("試行回数に応じた遅延を返す", () => {
    expect(calculateRetryDelayMs(1)).toBe(DEFAULT_RETRY_DELAYS_MS[0]);
    expect(calculateRetryDelayMs(2)).toBe(DEFAULT_RETRY_DELAYS_MS[1]);
    expect(calculateRetryDelayMs(5)).toBe(DEFAULT_RETRY_DELAYS_MS[4]);
  });

  it("最大試行回数以上または1未満の場合は null を返す", () => {
    expect(calculateRetryDelayMs(6)).toBeNull();
    expect(calculateRetryDelayMs(7)).toBeNull();
    expect(calculateRetryDelayMs(0)).toBeNull();
  });

  it("最大試行回数に達したかどうかを判定する", () => {
    expect(isMaxRetryAttemptsReached(DEFAULT_MAX_RETRY_ATTEMPTS - 1)).toBe(false);
    expect(isMaxRetryAttemptsReached(DEFAULT_MAX_RETRY_ATTEMPTS)).toBe(true);
    expect(isMaxRetryAttemptsReached(DEFAULT_MAX_RETRY_ATTEMPTS + 1)).toBe(true);
  });
});
