import { describe, expect, it } from "vitest";
import {
  calcPrevWeekDiff,
  calcPrevWeekRate,
  calcPrevWeekRatio,
  formatPrevWeekDiff,
  formatPrevWeekRate,
  formatPrevWeekRatioWithArrow,
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

  describe("calcPrevWeekRatio", () => {
    it("前週データがない場合は null を返す", () => {
      expect(calcPrevWeekRatio(38420, null)).toBeNull();
    });

    it("前週が0円の場合は null を返す", () => {
      expect(calcPrevWeekRatio(1000, 0)).toBeNull();
    });

    it("今週 ÷ 前週 × 100 を四捨五入する", () => {
      expect(calcPrevWeekRatio(38420, 41760)).toBe(92);
      expect(calcPrevWeekRatio(41760, 38420)).toBe(109);
      expect(calcPrevWeekRatio(14808, 1234)).toBe(1200);
    });

    it("同額の場合は100を返す", () => {
      expect(calcPrevWeekRatio(3000, 3000)).toBe(100);
    });
  });

  describe("calcPrevWeekRate", () => {
    it("前週データがない場合は null を返す", () => {
      expect(calcPrevWeekRate(38420, null)).toBeNull();
    });

    it("前週が0円の場合は null を返す", () => {
      expect(calcPrevWeekRate(1000, 0)).toBeNull();
    });

    it("増減率を四捨五入する", () => {
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
    it("増減率をフォーマットする", () => {
      expect(formatPrevWeekRate(-8)).toBe("-8%");
      expect(formatPrevWeekRate(0)).toBe("±0%");
      expect(formatPrevWeekRate(null)).toBe("前週データなし");
    });
  });

  describe("formatPrevWeekRatioWithArrow", () => {
    it("前週比（指数）に矢印を付けてフォーマットする", () => {
      expect(formatPrevWeekRatioWithArrow(92)).toBe("92% ↓");
      expect(formatPrevWeekRatioWithArrow(109)).toBe("109% ↑");
      expect(formatPrevWeekRatioWithArrow(1200)).toBe("1200% ↑");
      expect(formatPrevWeekRatioWithArrow(100)).toBe("100%");
      expect(formatPrevWeekRatioWithArrow(null)).toBe("前週データなし");
    });
  });
});
