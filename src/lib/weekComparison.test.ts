import { describe, expect, it } from "vitest";
import {
  calcPrevWeekDiff,
  calcPrevWeekRate,
  formatPrevWeekDiff,
  formatPrevWeekRate,
  formatPrevWeekRateWithArrow,
} from "./weekComparison";

describe("weekComparison", () => {
  describe("calcPrevWeekDiff", () => {
    it("前週データがない場合は null を返す", () => {
      expect(calcPrevWeekDiff(38420, null)).toBeNull();
    });

    it("差額を計算する", () => {
      expect(calcPrevWeekDiff(38420, 41760)).toBe(-3340);
      expect(calcPrevWeekDiff(41760, 38420)).toBe(3340);
    });
  });

  describe("calcPrevWeekRate", () => {
    it("前週データがない場合は null を返す", () => {
      expect(calcPrevWeekRate(38420, null)).toBeNull();
    });

    it("前週が0円の場合は null を返す", () => {
      expect(calcPrevWeekRate(1000, 0)).toBeNull();
    });

    it("前週比の百分率を四捨五入する", () => {
      expect(calcPrevWeekRate(38420, 41760)).toBe(-8);
      expect(calcPrevWeekRate(41760, 38420)).toBe(9);
    });

    it("同額の場合は0を返す", () => {
      expect(calcPrevWeekRate(3000, 3000)).toBe(0);
    });
  });

  describe("formatPrevWeekDiff", () => {
    it("差額をフォーマットする", () => {
      expect(formatPrevWeekDiff(-3340)).toBe("-3,340円");
      expect(formatPrevWeekDiff(0)).toBe("±0円");
      expect(formatPrevWeekDiff(null)).toBe("比較データなし");
    });
  });

  describe("formatPrevWeekRate", () => {
    it("前週比をフォーマットする", () => {
      expect(formatPrevWeekRate(-8)).toBe("-8%");
      expect(formatPrevWeekRate(0)).toBe("±0%");
      expect(formatPrevWeekRate(null)).toBe("前週データなし");
    });
  });

  describe("formatPrevWeekRateWithArrow", () => {
    it("前週比に矢印を付けてフォーマットする", () => {
      expect(formatPrevWeekRateWithArrow(-8)).toBe("-8% ↓");
      expect(formatPrevWeekRateWithArrow(9)).toBe("+9% ↑");
      expect(formatPrevWeekRateWithArrow(0)).toBe("±0%");
      expect(formatPrevWeekRateWithArrow(null)).toBe("前週データなし");
    });
  });
});
