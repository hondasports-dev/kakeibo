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
});
