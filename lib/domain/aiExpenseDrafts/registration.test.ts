import { describe, expect, it } from "vitest";
import {
  dedupeDraftIds,
  isAlreadyRegistered,
  isAlreadyRegisteredAsReceipt,
  validateReadyDraftForRegistration,
} from "./registration";

describe("validateReadyDraftForRegistration", () => {
  it("ready で date・amount・categoryId が揃っていれば成功", () => {
    expect(
      validateReadyDraftForRegistration({
        status: "ready",
        date: "2024-01-10",
        amountYen: 1000,
        categoryId: "cat-1",
      }),
    ).toEqual({ success: true });
  });

  it.each([
    [{ status: "needs_review" }, "not_ready"],
    [{ status: "ready" }, "missing_date"],
    [{ status: "ready", date: "2024-01-10" }, "missing_amount"],
    [{ status: "ready", date: "2024-01-10", amountYen: 0 }, "missing_amount"],
    [{ status: "ready", date: "2024-01-10", amountYen: 1000 }, "missing_category"],
  ] as const)("%o -> %s", (draft, expected) => {
    const result = validateReadyDraftForRegistration(draft as never);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(expected);
    }
  });
});

describe("dedupeDraftIds", () => {
  it("重複を除去する", () => {
    expect(dedupeDraftIds(["a", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("isAlreadyRegistered", () => {
  it.each([
    [{ status: "registered" }, true],
    [{ status: "ready" }, false],
  ] as const)("%o -> %s", (draft, expected) => {
    expect(isAlreadyRegistered(draft as never)).toBe(expected);
  });
});

describe("isAlreadyRegisteredAsReceipt", () => {
  it.each([
    [{ status: "registered", registeredReceiptId: "r1" }, true],
    [{ status: "registered" }, false],
    [{ status: "ready", registeredReceiptId: "r1" }, false],
  ] as const)("%o -> %s", (draft, expected) => {
    expect(isAlreadyRegisteredAsReceipt(draft as never)).toBe(expected);
  });
});
