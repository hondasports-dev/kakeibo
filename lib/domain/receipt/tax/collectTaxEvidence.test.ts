import { describe, expect, it } from "vitest";
import { collectTaxEvidence } from "./collectTaxEvidence";

describe("collectTaxEvidence", () => {
  it("108適用や標準税率108を8%/10%凡例として誤解釈しない", () => {
    const evidence = collectTaxEvidence({
      amountYen: 100,
      items: [
        {
          itemName: "商品",
          printedAmountYen: 100,
          taxRatePercent: null,
          amountBasis: "unknown",
          markers: ["a", "b"],
          warnings: [],
        },
      ],
      taxSummaries: [],
      markerDefinitions: [
        { marker: "a", description: "108適用" },
        { marker: "b", description: "標準税率108" },
      ],
    });

    const legends = evidence.filter((entry) => entry.type === "marker_legend");
    expect(legends).toHaveLength(2);
    expect(legends.every((entry) => entry.interpretedTaxRatePercent === undefined)).toBe(true);
  });

  it("8適用と標準税率10は正しく解釈する", () => {
    const evidence = collectTaxEvidence({
      amountYen: 100,
      items: [
        {
          itemName: "商品",
          printedAmountYen: 100,
          taxRatePercent: null,
          amountBasis: "unknown",
          markers: ["a", "b"],
          warnings: [],
        },
      ],
      taxSummaries: [],
      markerDefinitions: [
        { marker: "a", description: "8%適用" },
        { marker: "b", description: "標準税率10" },
      ],
    });

    const legends = evidence.filter((entry) => entry.type === "marker_legend");
    expect(legends[0]?.interpretedTaxRatePercent).toBe(8);
    expect(legends[1]?.interpretedTaxRatePercent).toBe(10);
  });
});
