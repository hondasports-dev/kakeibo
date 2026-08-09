import { describe, expect, it } from "vitest";
import { getImageCaptureFailureHint } from "./failure";

describe("getImageCaptureFailureHint", () => {
  it("failed ステータスでは撮影ヒントを返す", () => {
    expect(getImageCaptureFailureHint("failed")).toBe(
      "明るい場所で、影や反射を避け、レシート全体を正面から撮影してください。",
    );
  });

  it("failed 以外では undefined を返す", () => {
    expect(getImageCaptureFailureHint("queued")).toBeUndefined();
    expect(getImageCaptureFailureHint("analyzing")).toBeUndefined();
    expect(getImageCaptureFailureHint("ready")).toBeUndefined();
    expect(getImageCaptureFailureHint("needs_review")).toBeUndefined();
    expect(getImageCaptureFailureHint("registered")).toBeUndefined();
  });
});
