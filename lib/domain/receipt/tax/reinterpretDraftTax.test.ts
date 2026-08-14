import { describe, expect, it } from "vitest";
import { trialExternal8Fixture } from "../../../convex/receiptImageExtraction/fixtures/taxFixtures";
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
    expect(after.itemFields[1]?.taxResolutionStatus).toBe("unresolved");
    expect(after.itemFields[2]?.taxResolutionStatus).toBe("unresolved");
  });

  it("bulkUnresolvedOverride は未解決行すべてに税率とamountBasisを適用する", () => {
    const unresolvedItems = [
      {
        itemName: "A",
        printedAmountYen: 4000,
        amountBasis: "unknown" as const,
        taxRatePercent: null,
        taxResolutionStatus: "unresolved" as const,
        markers: [] as string[],
        warnings: [] as string[],
      },
      {
        itemName: "B",
        printedAmountYen: 3928,
        amountBasis: "unknown" as const,
        taxRatePercent: null,
        taxResolutionStatus: "unresolved" as const,
        markers: [] as string[],
        warnings: [] as string[],
      },
    ];

    const result = reinterpretDraftTax({
      amountYen: 8562,
      items: unresolvedItems,
      taxSummaries: [
        {
          taxRatePercent: 8,
          taxMode: "external",
          taxableAmountYen: 7928,
          taxableAmountBasis: "tax_excluded",
          taxYen: 634,
          roundingMethod: "unknown",
          confidence: {},
          warnings: [],
        },
      ],
      bulkUnresolvedOverride: {
        taxRatePercent: 8,
        amountBasis: "tax_excluded",
      },
    });

    expect(result.itemFields.every((field) => field.taxResolutionStatus === "resolved")).toBe(true);
    expect(result.itemFields.every((field) => field.taxRatePercent === 8)).toBe(true);
    expect(
      result.itemFields.reduce((sum, field) => sum + (field.normalizedAmountYen ?? 0), 0),
    ).toBe(8562);
  });

  it("bulkUnresolvedOverride は部分上書き済みの税率を維持する", () => {
    const items = [
      {
        itemName: "A",
        printedAmountYen: 500,
        amountBasis: "unknown" as const,
        taxRatePercent: 8 as const,
        markers: [] as string[],
        warnings: [] as string[],
      },
      {
        itemName: "B",
        printedAmountYen: 500,
        amountBasis: "unknown" as const,
        taxRatePercent: null,
        markers: [] as string[],
        warnings: [] as string[],
      },
    ];

    const result = reinterpretDraftTax({
      amountYen: 1000,
      items,
      taxSummaries: [
        {
          taxRatePercent: 8,
          taxMode: "included",
          taxableAmountYen: 1000,
          taxableAmountBasis: "tax_included",
          taxYen: 74,
          roundingMethod: "unknown",
          confidence: {},
          warnings: [],
        },
      ],
      bulkUnresolvedOverride: {
        taxRatePercent: 10,
        amountBasis: "tax_included",
      },
    });

    expect(result.itemFields[0]?.taxRatePercent).toBe(8);
    expect(result.itemFields[1]?.taxRatePercent).toBe(10);
    expect(result.itemFields[1]?.amountBasis).toBe("tax_included");
  });
});
