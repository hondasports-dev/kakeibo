import type { ReceiptTaxInput, TaxEvidence, TaxRatePercent } from "./types";

function interpretLegend(description: string): TaxRatePercent | undefined {
  if (/(?:^|\D)8\s*%|軽減税率\s*8|8\s*%?\s*適応|8\s*%?\s*適用/.test(description)) return 8;
  if (/(?:^|\D)10\s*%|標準税率\s*10/.test(description)) return 10;
  if (/(?:^|\D)0\s*%|非課税|免税/.test(description)) return 0;
  return undefined;
}

export function collectTaxEvidence(input: ReceiptTaxInput): TaxEvidence[] {
  const evidence: TaxEvidence[] = input.taxSummaries.map((summary) => ({
    type: "tax_summary",
    taxRatePercent: summary.taxRatePercent,
    taxableAmountYen: summary.taxableAmountYen,
    amountBasis: summary.taxableAmountBasis,
  }));
  input.items.forEach((item, itemIndex) => {
    if (item.taxRatePercent !== null) {
      evidence.push({ type: "item_explicit_rate", itemIndex, taxRatePercent: item.taxRatePercent });
    }
    for (const marker of item.markers) {
      const definition = input.markerDefinitions?.find((value) => value.marker === marker);
      if (!definition) continue;
      evidence.push({
        type: "marker_legend",
        itemIndex,
        marker,
        description: definition.description,
        interpretedTaxRatePercent: interpretLegend(definition.description),
      });
    }
  });
  return evidence;
}
