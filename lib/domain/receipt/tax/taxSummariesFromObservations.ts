import type { ReceiptRawObservationLine } from "../observations";
import type { ExtractedTaxSummary, TaxRatePercent } from "./types";

type TaxParts = {
  target?: number;
  tax?: number;
  mode?: "included" | "external";
  ambiguous?: boolean;
};

const RATE_PATTERN = /(?:税率\s*)?(0|8|10)\s*%/;

/** AI が taxSummaries を落とした場合に、明示印字された税率別行だけから安全に復元する。 */
export function deriveTaxSummariesFromObservations(
  lines: ReceiptRawObservationLine[],
): ExtractedTaxSummary[] {
  const byRate = new Map<TaxRatePercent, TaxParts>();

  for (const line of lines) {
    if (!line.explicitlyPrinted || line.amountYen === null || line.amountYen < 0) continue;
    const text = line.rawText.normalize("NFKC").replace(/\s+/g, "");
    const rateMatch = text.match(RATE_PATTERN);
    if (!rateMatch) continue;
    const rate = Number(rateMatch[1]) as TaxRatePercent;
    const parts = byRate.get(rate) ?? {};
    const isTarget = /(?:対象|タイショウ)/.test(text);
    const isTax = /(?:税額|消費税|内税|外税)/.test(text) && !isTarget;
    const mode = /(?:外税|税抜|税別)/.test(text)
      ? "external"
      : /(?:内税|税込|免税)/.test(text)
        ? "included"
        : undefined;

    if (mode !== undefined && parts.mode !== undefined && parts.mode !== mode) {
      parts.ambiguous = true;
    }

    if (isTarget) {
      if (parts.target !== undefined && parts.target !== line.amountYen) parts.ambiguous = true;
      parts.target = line.amountYen;
      parts.mode ??= mode;
    } else if (isTax) {
      if (parts.tax !== undefined && parts.tax !== line.amountYen) parts.ambiguous = true;
      parts.tax = line.amountYen;
      parts.mode ??= mode;
    }
    if (rate === 0 && isTarget) {
      parts.tax = 0;
      parts.mode = "included";
    }
    byRate.set(rate, parts);
  }

  return [...byRate.entries()].flatMap(([taxRatePercent, parts]) => {
    if (
      parts.ambiguous ||
      parts.target === undefined ||
      parts.tax === undefined ||
      parts.mode === undefined
    )
      return [];
    const includedAmount = parts.mode === "external" ? parts.target + parts.tax : parts.target;
    return [
      {
        taxRatePercent,
        taxMode: parts.mode,
        taxableAmountYen: parts.target,
        taxableAmountBasis:
          parts.mode === "external" ? ("tax_excluded" as const) : ("tax_included" as const),
        taxYen: parts.tax,
        taxIncludedAmountYen: includedAmount,
        roundingMethod: "unknown" as const,
        confidence: {
          taxRatePercent: 0.8,
          taxMode: 0.8,
          taxableAmountYen: 0.8,
          taxYen: 0.8,
        },
        warnings: ["tax_summary_recovered_from_raw_observations"],
      },
    ];
  });
}
