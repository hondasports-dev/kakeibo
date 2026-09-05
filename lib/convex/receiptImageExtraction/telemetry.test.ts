import { describe, expect, it, vi } from "vitest";
import { measureReceiptExtractionSave } from "./telemetry";

describe("measureReceiptExtractionSave", () => {
  it("失敗下書きの保存成功をsave段階として記録する", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await expect(
      measureReceiptExtractionSave("job-1", "failure_draft", async () => "draft-1"),
    ).resolves.toBe("draft-1");
    expect(info).toHaveBeenCalledWith(
      "receipt_extraction_stage",
      expect.objectContaining({
        telemetryId: "job-1",
        stage: "save",
        outcome: "success",
        saveKind: "failure_draft",
      }),
    );
  });

  it("保存失敗をdraft_saveとして記録して再throwする", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = new Error("save failed");

    await expect(
      measureReceiptExtractionSave("job-2", "result_draft", async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(info).toHaveBeenCalledWith(
      "receipt_extraction_stage",
      expect.objectContaining({
        telemetryId: "job-2",
        stage: "save",
        outcome: "failure",
        failureKind: "draft_save",
        saveKind: "result_draft",
      }),
    );
  });
});
