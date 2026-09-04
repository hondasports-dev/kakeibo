import { afterEach, describe, expect, it, vi } from "vitest";
import { callOpenAIReceiptExtractor } from "./openaiClient";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("callOpenAIReceiptExtractor failure stages", () => {
  it.each([
    [Object.assign(new Error("timed out"), { name: "TimeoutError" }), "timeout"],
    [new SyntaxError("invalid json"), "malformed_json"],
    [new TypeError("body stream failed"), "network"],
  ])("JSON本文の読み込み失敗を原因別に分類する", async (error, expectedKind) => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(error),
    } as unknown as Response);

    await expect(
      callOpenAIReceiptExtractor({
        imageDataUrl: "data:image/jpeg;base64,AAA",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(new RegExp(`receipt_extraction:${expectedKind}`));
    expect(info).toHaveBeenCalledWith(
      "receipt_extraction_stage",
      expect.objectContaining({
        stage: "json_parse",
        outcome: "failure",
        failureKind: expectedKind,
      }),
    );
  });

  it("incomplete応答をdomain parse前に分類し、usageだけをtelemetryへ出す", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          usage: { input_tokens: 100, output_tokens: 200, total_tokens: 300 },
          output: [],
        }),
        { status: 200 },
      ),
    );

    await expect(
      callOpenAIReceiptExtractor({
        imageDataUrl: "data:image/jpeg;base64,AAA",
        apiKey: "test-key",
        telemetryId: "job-1",
      }),
    ).rejects.toThrow(/receipt_extraction:incomplete/);
    expect(info).toHaveBeenCalledWith(
      "receipt_extraction_stage",
      expect.objectContaining({
        telemetryId: "job-1",
        stage: "json_parse",
        responseStatus: "incomplete",
        incompleteReason: "max_output_tokens",
        totalTokens: 300,
      }),
    );
  });

  it("応答後のdomain validation失敗を通信失敗と区別する", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
        }),
        { status: 200 },
      ),
    );

    await expect(
      callOpenAIReceiptExtractor({
        imageDataUrl: "data:image/jpeg;base64,AAA",
        apiKey: "test-key",
      }),
    ).rejects.toThrow(/receipt_extraction:domain_validation/);
    expect(info).toHaveBeenCalledWith(
      "receipt_extraction_stage",
      expect.objectContaining({
        stage: "domain_validation",
        outcome: "failure",
        failureKind: "domain_validation",
        failureDetail: expect.stringContaining("shopName"),
      }),
    );
  });
});
