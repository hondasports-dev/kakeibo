import { describe, expect, it } from "vitest";
import { trialExternal8Fixture } from "../convex/receiptImageExtraction/fixtures/taxFixtures";
import { reinterpretDraftTax } from "./reinterpretDraftTax";

describe("reinterpretDraftTax", () => {
  it("reinterprets draft items without changing printed amounts", () => {
    const items = trialExternal8Fixture.items!.map((item) => ({
      itemName: item.itemName,
      printedAmountYen: item.printedAmountYen ?? item.amountYen,
      amountBasis: item.amountBasis ?? "unknown",
      taxRatePercent: item.taxRatePercent ?? null,
      markers: item.markers ?? [],
      taxMarker: item.taxMarker,
      warnings: item.warnings,
    }));

    const result = reinterpretDraftTax({
      amountYen: trialExternal8Fixture.amountYen,
      taxSummaries: trialExternal8Fixture.taxSummaries!,
      markerDefinitions: trialExternal8Fixture.markerDefinitions,
      items,
    });

    expect(result.itemFields.every((field) => field.taxResolutionStatus === "resolved")).toBe(true);
    expect(
      result.itemFields.reduce((sum, field) => sum + (field.normalizedAmountYen ?? 0), 0),
    ).toBe(1683);
    expect(
      items.every(
        (item, index) => item.printedAmountYen === result.itemFields[index]?.printedAmountYen,
      ),
    ).toBe(true);
  });

  it("applies user tax rate override and re-normalizes amounts", () => {
    const unresolvedItems = [
      {
        itemName: "A",
        printedAmountYen: 300,
        amountBasis: "unknown" as const,
        taxRatePercent: null,
        markers: [] as string[],
        warnings: [] as string[],
      },
      {
        itemName: "B",
        printedAmountYen: 300,
        amountBasis: "unknown" as const,
        taxRatePercent: null,
        markers: [] as string[],
        warnings: [] as string[],
      },
      {
        itemName: "C",
        printedAmountYen: 400,
        amountBasis: "unknown" as const,
        taxRatePercent: null,
        markers: [] as string[],
        warnings: [] as string[],
      },
    ];
    const taxSummaries = [
      {
        taxRatePercent: 8 as const,
        taxMode: "included" as const,
        taxableAmountYen: 500,
        taxableAmountBasis: "tax_included" as const,
        taxYen: 0,
        roundingMethod: "unknown" as const,
        confidence: {},
        warnings: [] as string[],
      },
      {
        taxRatePercent: 10 as const,
        taxMode: "included" as const,
        taxableAmountYen: 500,
        taxableAmountBasis: "tax_included" as const,
        taxYen: 0,
        roundingMethod: "unknown" as const,
        confidence: {},
        warnings: [] as string[],
      },
    ];

    const before = reinterpretDraftTax({
      amountYen: 1000,
      items: unresolvedItems,
      taxSummaries,
    });
    expect(before.itemFields.every((field) => field.taxResolutionStatus === "unresolved")).toBe(
      true,
    );

    const after = reinterpretDraftTax({
      amountYen: 1000,
      items: unresolvedItems,
      taxSummaries,
      override: { itemIndex: 0, taxRatePercent: 8, amountBasis: "tax_included" },
    });

    expect(after.itemFields[0]?.taxResolutionStatus).toBe("resolved");
    expect(after.itemFields[0]?.taxRatePercent).toBe(8);
    expect(after.itemFields[0]?.printedAmountYen).toBe(300);
  });
});
