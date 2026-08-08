import { describe, expect, it } from "vitest";
import { calcPrevWeekDiff, calcPrevWeekRate, calcPrevWeekRatio } from "./comparison";

describe("week/comparison", () => {
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
});
