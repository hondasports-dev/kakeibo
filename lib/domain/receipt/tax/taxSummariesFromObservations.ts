import type { ReceiptRawObservationLine } from "../observations";
import type { ExtractedTaxSummary, TaxRatePercent } from "./types";

type TaxParts = {
  target?: number;
  tax?: number;
  mode?: "included" | "external";
  ambiguous?: boolean;
  includedTarget?: number;
  externalTarget?: number;
  unknownTarget?: number;
};

const RATE_PATTERN = /(?:税率\s*)?(0|8|10)\s*%/;

/** AI が taxSummaries を落とした場合に、明示印字された税率別行だけから安全に復元する。 */
export function deriveTaxSummariesFromObservations(
  lines: ReceiptRawObservationLine[],
  receiptTotalYen?: number | null,
): ExtractedTaxSummary[] {
  const byRate = new Map<TaxRatePercent, TaxParts>();

  for (const line of lines) {
    if (!line.explicitlyPrinted || line.amountYen === null || line.amountYen < 0) continue;
    const text = line.rawText.normalize("NFKC").replace(/\s+/g, "");
    const rateMatch = text.match(RATE_PATTERN);
    if (!rateMatch) continue;
    const rate = Number(rateMatch[1]) as TaxRatePercent;
    const parts = byRate.get(rate) ?? {};
    const isTarget = /(?:対象|タイショウ)/.test(text) && !/対象消費税/.test(text);
    const isTax = /(?:税額|消費税|内税|外税|\(内\)税)/.test(text) && !isTarget;
    const mode = /(?:外税|税抜|税別)/.test(text)
      ? "external"
      : /(?:内税|税込|免税|\(内\)税)/.test(text)
        ? "included"
        : undefined;

    if (isTarget) {
      const key =
        mode === "external"
          ? "externalTarget"
          : mode === "included"
            ? "includedTarget"
            : "unknownTarget";
      if (parts[key] !== undefined && parts[key] !== line.amountYen) parts.ambiguous = true;
      parts[key] = line.amountYen;
      if (mode === "external" || parts.mode === undefined) parts.mode = mode;
    } else if (isTax) {
      if (parts.tax !== undefined && parts.tax !== line.amountYen) parts.ambiguous = true;
      parts.tax = line.amountYen;
      if (mode === "external" || parts.mode === undefined) parts.mode = mode;
    }
    if (rate === 0 && isTarget) {
      parts.tax = 0;
      parts.mode ??= "included";
    }
    byRate.set(rate, parts);
  }

  // A single-rate external receipt can print only subtotal + tax, without a target row.
  const subtotals = [
    ...new Set(
      lines
        .filter(
          (line) =>
            line.explicitlyPrinted && /小\s*計/.test(line.rawText) && line.amountYen !== null,
        )
        .map((line) => line.amountYen!),
    ),
  ];
  for (const [rate, parts] of byRate) {
    if (parts.unknownTarget !== undefined && parts.tax !== undefined) {
      const target = parts.unknownTarget;
      if (parts.mode === "external") {
        const excludedFits = Math.abs(parts.tax - (target * rate) / 100) < 1;
        const includedFits =
          target >= parts.tax && Math.abs(parts.tax - ((target - parts.tax) * rate) / 100) < 1;
        // Unlabelled targets are not necessarily gross. Require a unique arithmetic basis.
        if (excludedFits === includedFits) parts.ambiguous = true;
        else {
          const key = excludedFits ? "externalTarget" : "includedTarget";
          if (parts[key] !== undefined && parts[key] !== target) parts.ambiguous = true;
          parts[key] = target;
        }
      } else if (parts.mode === "included" || target === receiptTotalYen) {
        if (parts.includedTarget !== undefined && parts.includedTarget !== target)
          parts.ambiguous = true;
        parts.includedTarget = target;
      }
    }
    if (
      parts.mode === undefined &&
      parts.includedTarget === receiptTotalYen &&
      parts.tax !== undefined &&
      parts.includedTarget !== undefined &&
      Math.abs(parts.tax - (parts.includedTarget * rate) / (100 + rate)) < 1
    )
      parts.mode = "included";
    if (parts.mode === "external") {
      parts.target =
        parts.externalTarget ??
        (parts.includedTarget !== undefined && parts.tax !== undefined
          ? parts.includedTarget - parts.tax
          : byRate.size === 1 &&
              subtotals.length === 1 &&
              parts.tax !== undefined &&
              subtotals[0] + parts.tax === receiptTotalYen &&
              Math.abs(parts.tax - (subtotals[0] * rate) / 100) < 1
            ? subtotals[0]
            : undefined);
      if (
        parts.externalTarget !== undefined &&
        parts.includedTarget !== undefined &&
        parts.externalTarget + (parts.tax ?? 0) !== parts.includedTarget
      )
        parts.ambiguous = true;
    } else {
      parts.target = parts.includedTarget;
    }
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
