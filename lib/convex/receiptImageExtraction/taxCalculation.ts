import type { TaxRatePercent } from "./types";

export type TaxRoundingMethod = "floor" | "round" | "ceil";

export function calculateTaxYen(args: {
  taxableAmountYen: number;
  taxRatePercent: TaxRatePercent;
  roundingMethod: TaxRoundingMethod;
}): number {
  const { taxableAmountYen, taxRatePercent, roundingMethod } = args;
  if (!Number.isInteger(taxableAmountYen) || taxableAmountYen < 0) {
    throw new TypeError("taxableAmountYen must be a non-negative integer");
  }
  if (taxRatePercent !== 0 && taxRatePercent !== 8 && taxRatePercent !== 10) {
    throw new TypeError("taxRatePercent must be 0, 8, or 10");
  }
  if (roundingMethod !== "floor" && roundingMethod !== "round" && roundingMethod !== "ceil") {
    throw new TypeError("roundingMethod must be floor, round, or ceil");
  }
  const product = taxableAmountYen * taxRatePercent;
  const quotient = Math.floor(product / 100);
  const remainder = product % 100;
  if (roundingMethod === "round") return quotient + (remainder >= 50 ? 1 : 0);
  if (roundingMethod === "ceil") return quotient + (remainder > 0 ? 1 : 0);
  return quotient;
}
