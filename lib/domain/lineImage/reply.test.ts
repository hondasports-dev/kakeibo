import { afterEach, describe, expect, it } from "vitest";
import {
  LINE_IMAGE_REVIEW_PATH,
  buildLineImageReviewUrl,
  formatLineImageAnalysisFailedReply,
  formatLineImageDraftCreatedReply,
} from "./reply";

describe("LINE image reply copy", () => {
  afterEach(() => {
    delete process.env.APP_BASE_URL;
  });

  it("Web確認URLは入力画面へ誘導し、家計金額を含まない", () => {
    process.env.APP_BASE_URL = "https://suzumemo.test/";
    const reviewUrl = buildLineImageReviewUrl();
    expect(reviewUrl).toBe(`https://suzumemo.test${LINE_IMAGE_REVIEW_PATH}`);
    const created = formatLineImageDraftCreatedReply(reviewUrl);
    const failed = formatLineImageAnalysisFailedReply(reviewUrl);
    expect(created).toContain("確認");
    expect(created).toContain(reviewUrl);
    expect(failed).toContain(reviewUrl);
    expect(created).not.toMatch(/\d+円/);
    expect(failed).not.toMatch(/\d+円/);
  });
});
