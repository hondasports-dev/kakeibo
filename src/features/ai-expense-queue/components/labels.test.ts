import { describe, expect, it } from "vitest";
import { displayStatusLabels, getDisplayStatus } from "./labels";

describe("queue display status labels", () => {
  it("主要5状態へ統一マッピングする", () => {
    expect(getDisplayStatus("needs_review")).toBe("needs_review");
    expect(getDisplayStatus("ready")).toBe("ready");
    expect(getDisplayStatus("failed")).toBe("failed");
    expect(getDisplayStatus("registered")).toBe("registered");
    expect(getDisplayStatus("queued")).toBe("processing");
    expect(getDisplayStatus("analyzing")).toBe("processing");
    expect(displayStatusLabels.processing).toBe("解析中");
    expect(displayStatusLabels.ready).toBe("登録準備OK");
  });
});
