import { describe, expect, it } from "vitest";
import { RECEIPT_EXTRACTION_PROMPT_LINES } from "./openaiSchema";

describe("RECEIPT_EXTRACTION_PROMPT_LINES", () => {
  it("割引は印字位置を考慮して対象商品カテゴリへ帰属させ、不明時は推測しない", () => {
    const prompt = RECEIPT_EXTRACTION_PROMPT_LINES.join("\n");

    expect(prompt).toContain("直前または近接する商品");
    expect(prompt).toContain("対象商品と同じ categoryName");
    expect(prompt).toContain("推測でカテゴリを設定せず");
  });
});
