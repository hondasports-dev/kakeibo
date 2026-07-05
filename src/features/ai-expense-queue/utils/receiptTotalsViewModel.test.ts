import { describe, expect, it } from "vitest";
import type { ReviewItemValues } from "../types/types";
import { toReceiptTotalsViewModel } from "./receiptTotalsViewModel";

function item(printedAmountYen: number, unresolved = true): ReviewItemValues {
  return {
    id: `item-${printedAmountYen}`,
    itemName: "商品",
    amountYen: String(printedAmountYen),
    categoryId: "cat1",
    printedAmountYen,
    taxResolutionStatus: unresolved ? "unresolved" : "resolved",
    taxRatePercent: unresolved ? null : 8,
    amountBasis: unresolved ? "unknown" : "tax_excluded",
    taxResolutionSource: unresolved ? undefined : "single_summary",
  };
}

describe("toReceiptTotalsViewModel", () => {
  it("石守相当: 8562 / 7958 / 7928 の差分と案内を返す", () => {
    const reviewItems = Array.from({ length: 32 }, (_, index) =>
      item(index === 0 ? 7958 - 31 * 100 : 100),
    );
    reviewItems[0] = item(7958 - 31 * 100);

    const vm = toReceiptTotalsViewModel({
      paidTotalYen: 8562,
      reviewItems: [item(4000), item(3928), item(30)],
      taxSummaries: [
        {
          taxRatePercent: 8,
          taxMode: "external",
          taxableAmountYen: 7928,
          taxableAmountBasis: "tax_excluded",
          taxYen: 634,
          roundingMethod: "unknown",
          warnings: [],
        },
      ],
    });

    expect(vm.itemsPrintedTotalYen).toBe(7958);
    expect(vm.gapPaidVsItems).toBe(604);
    expect(vm.gapItemsVsSubtotal).toBe(30);
    expect(vm.status).toBe("mismatch");
    expect(vm.guidanceLines[0]).toContain("件の税率が未確定");
    expect(vm.guidanceLines[1]).toBe("お支払いより604円不足しています");
    expect(vm.canBulkApplyTax).toBe(true);
    expect(vm.bulkTaxLabel).toBe("このレシートは「8%・外税」と読み取りました");
  });

  it("一致時は matched と案内1行", () => {
    const vm = toReceiptTotalsViewModel({
      paidTotalYen: 1060,
      reviewItems: [
        {
          id: "1",
          itemName: "商品",
          amountYen: "1060",
          categoryId: "cat1",
          printedAmountYen: 1060,
          taxResolutionStatus: "resolved",
          taxRatePercent: 10,
          amountBasis: "tax_included",
          taxResolutionSource: "single_summary",
        },
      ],
      taxSummaries: [
        {
          taxRatePercent: 10,
          taxMode: "included",
          taxableAmountYen: 1060,
          taxableAmountBasis: "tax_included",
          taxYen: 96,
          roundingMethod: "unknown",
          warnings: [],
        },
      ],
    });

    expect(vm.status).toBe("matched");
    expect(vm.guidanceLines).toEqual(["金額は一致しています"]);
    expect(vm.canBulkApplyTax).toBe(false);
  });

  it("taxSummaries なしは小計 unavailable", () => {
    const vm = toReceiptTotalsViewModel({
      paidTotalYen: 500,
      reviewItems: [item(500, false)],
      taxSummaries: undefined,
    });

    expect(vm.receiptSubtotalLabel).toBe("読み取れませんでした");
    expect(vm.gapItemsVsSubtotal).toBeUndefined();
    expect(vm.status).toBe("subtotalUnavailable");
  });

  it("明細なしはパネル非表示", () => {
    const vm = toReceiptTotalsViewModel({
      paidTotalYen: 1000,
      reviewItems: [],
    });

    expect(vm.showPanel).toBe(false);
  });
});
