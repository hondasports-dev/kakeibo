import { describe, expect, it } from "vitest";
import { calculateResizeDimensions } from "./imageDataUrl";

describe("calculateResizeDimensions", () => {
  it("縦長画像はlong sideより可読幅を優先する", () => {
    expect(calculateResizeDimensions(4590, 8160, { longSide: 1600, minShortSide: 1000 })).toEqual({
      width: 1000,
      height: 1778,
    });
  });

  it("小さい画像は拡大しない", () => {
    expect(calculateResizeDimensions(600, 800, { longSide: 1600, minShortSide: 1000 })).toEqual({
      width: 600,
      height: 800,
    });
  });

  it("短辺が可読幅未満の極端な長尺画像も長辺上限まで縮小する", () => {
    expect(calculateResizeDimensions(500, 5000, { longSide: 1600, minShortSide: 1000 })).toEqual({
      width: 160,
      height: 1600,
    });
  });
});
