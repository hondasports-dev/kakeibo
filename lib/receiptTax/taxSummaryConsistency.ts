import type {
  AmountBasis,
  ExtractedTaxSummary,
  TaxMode,
  TaxSummaryConsistency,
  TaxSummaryConsistencyReason,
} from "./types";

type ReconcileTaxSummaryArgs = {
  amountYen?: number;
  summary: ExtractedTaxSummary;
};

type ResolvedMode = Extract<TaxMode, "included" | "external">;

function resolveReason(reason: ResolvedMode): TaxSummaryConsistencyReason {
  return reason === "included" ? "reconciled_to_included" : "reconciled_to_external";
}

function detectTargetMode(
  A: number,
  T: number,
  expectedAmount: number | undefined,
):
  | { mode: "included"; basis: "tax_included" }
  | { mode: "external"; basis: "tax_excluded" }
  | undefined {
  if (expectedAmount === undefined) return undefined;
  if (A === expectedAmount) {
    return { mode: "included", basis: "tax_included" };
  }
  if (A + T === expectedAmount) {
    return { mode: "external", basis: "tax_excluded" };
  }
  return undefined;
}

export function reconcileTaxSummary({
  amountYen,
  summary,
}: ReconcileTaxSummaryArgs): TaxSummaryConsistency {
  const A = summary.taxableAmountYen;
  const T = summary.taxYen;
  const I = summary.taxIncludedAmountYen;
  const totalAmount = amountYen;
  const expectedAmount = totalAmount ?? I;

  const { taxMode, taxableAmountBasis } = summary;

  // 1. mode / basis contradiction
  if (taxMode === "included" && taxableAmountBasis === "tax_excluded") {
    const reasons: TaxSummaryConsistencyReason[] = ["included_mode_with_tax_excluded_basis"];
    if (expectedAmount !== undefined && A !== expectedAmount && A + T !== expectedAmount) {
      reasons.push("tax_summary_amount_mismatch");
    }
    if (I !== undefined && totalAmount !== undefined && I !== totalAmount) {
      reasons.push("tax_included_amount_mismatch");
    }
    return { status: "conflicting", reasons };
  }

  if (taxMode === "external" && taxableAmountBasis === "tax_included") {
    const reasons: TaxSummaryConsistencyReason[] = ["external_mode_with_tax_included_basis"];
    if (expectedAmount !== undefined && A !== expectedAmount && A + T !== expectedAmount) {
      reasons.push("tax_summary_amount_mismatch");
    }
    if (I !== undefined && totalAmount !== undefined && I !== totalAmount) {
      reasons.push("tax_included_amount_mismatch");
    }
    return { status: "conflicting", reasons };
  }

  if (taxMode === "mixed") {
    return { status: "conflicting", reasons: ["mixed_tax_mode"] };
  }

  const targetFromAmount = detectTargetMode(A, T, expectedAmount);

  // 2. both unknown
  if (taxMode === "unknown" && taxableAmountBasis === "unknown") {
    if (targetFromAmount) {
      return { status: "reconcilable", reasons: [resolveReason(targetFromAmount.mode)] };
    }
    return { status: "conflicting", reasons: ["unresolved_tax_summary"] };
  }

  // 3. mode unknown, basis known
  if (taxMode === "unknown") {
    if (taxableAmountBasis === "tax_included") {
      if (targetFromAmount?.mode === "included") {
        return { status: "reconcilable", reasons: ["reconciled_to_included"] };
      }
      if (targetFromAmount?.mode === "external" && A + T === expectedAmount) {
        // basis says tax_included but the amount relation indicates external
        return { status: "reconcilable", reasons: ["reconciled_to_external"] };
      }
      const reasons: TaxSummaryConsistencyReason[] = [];
      if (expectedAmount !== undefined && A !== expectedAmount) {
        reasons.push("tax_summary_amount_mismatch");
      }
      if (I !== undefined && totalAmount !== undefined && I !== totalAmount) {
        reasons.push("tax_included_amount_mismatch");
      }
      return reasons.length > 0
        ? { status: "conflicting", reasons }
        : { status: "conflicting", reasons: ["unresolved_tax_summary"] };
    }

    if (taxableAmountBasis === "tax_excluded") {
      if (targetFromAmount?.mode === "external") {
        return { status: "reconcilable", reasons: ["reconciled_to_external"] };
      }
      if (targetFromAmount?.mode === "included" && A === expectedAmount) {
        // basis says tax_excluded but the amount relation indicates included
        return { status: "reconcilable", reasons: ["reconciled_to_included"] };
      }
      const reasons: TaxSummaryConsistencyReason[] = [];
      if (expectedAmount !== undefined && A + T !== expectedAmount) {
        reasons.push("tax_summary_amount_mismatch");
      }
      if (I !== undefined && totalAmount !== undefined && I !== totalAmount) {
        reasons.push("tax_included_amount_mismatch");
      }
      return reasons.length > 0
        ? { status: "conflicting", reasons }
        : { status: "conflicting", reasons: ["unresolved_tax_summary"] };
    }

    return { status: "conflicting", reasons: ["unresolved_tax_summary"] };
  }

  // 4. basis unknown, mode known
  if (taxableAmountBasis === "unknown") {
    let targetMode: ResolvedMode = taxMode === "included" ? "included" : "external";

    if (targetFromAmount && targetFromAmount.mode !== targetMode) {
      // amount relation contradicts the declared mode; prefer the amount relation
      targetMode = targetFromAmount.mode;
    }

    if (targetMode === taxMode) {
      return { status: "reconcilable", reasons: [resolveReason(targetMode)] };
    }
    return { status: "reconcilable", reasons: [resolveReason(targetMode)] };
  }

  // 5. both known and consistent
  const targetMode: ResolvedMode =
    targetFromAmount?.mode ?? (taxMode === "included" ? "included" : "external");
  const targetBasis: AmountBasis =
    targetFromAmount?.basis ?? (taxMode === "included" ? "tax_included" : "tax_excluded");

  if (targetMode === taxMode && targetBasis === taxableAmountBasis) {
    if (I !== undefined && expectedAmount !== undefined && I !== expectedAmount) {
      const reasons: TaxSummaryConsistencyReason[] = ["tax_included_amount_mismatch"];
      if (targetFromAmount === undefined) {
        if (taxMode === "included" && A !== expectedAmount) {
          reasons.push("tax_summary_amount_mismatch");
        }
        if (taxMode === "external" && A + T !== expectedAmount) {
          reasons.push("tax_summary_amount_mismatch");
        }
      }
      return { status: "conflicting", reasons };
    }
    if (targetFromAmount === undefined && I !== undefined && expectedAmount !== undefined) {
      // I is present but neither A nor A+T matches it; the declared mode/basis is contradicted by amounts
      const reasons: TaxSummaryConsistencyReason[] = [];
      if (taxMode === "included" && A !== expectedAmount) {
        reasons.push("tax_summary_amount_mismatch");
      }
      if (taxMode === "external" && A + T !== expectedAmount) {
        reasons.push("tax_summary_amount_mismatch");
      }
      return reasons.length > 0
        ? { status: "conflicting", reasons }
        : { status: "coherent", reasons: [] };
    }
    // I undefined: we cannot fully verify from amountYen alone, so trust the declared mode/basis
    return { status: "coherent", reasons: [] };
  }

  // 6. both known but inconsistent with amount relation
  if (targetFromAmount) {
    if (I === undefined || I === expectedAmount) {
      return { status: "reconcilable", reasons: [resolveReason(targetFromAmount.mode)] };
    }
    return { status: "conflicting", reasons: ["tax_included_amount_mismatch"] };
  }

  // 7. both known, no amount relation, and I present
  if (I !== undefined && expectedAmount !== undefined) {
    const reasons: TaxSummaryConsistencyReason[] = [];
    if (taxMode === "included" && A !== expectedAmount) {
      reasons.push("tax_summary_amount_mismatch");
    }
    if (taxMode === "external" && A + T !== expectedAmount) {
      reasons.push("tax_summary_amount_mismatch");
    }
    if (I !== expectedAmount) {
      reasons.push("tax_included_amount_mismatch");
    }
    return { status: "conflicting", reasons };
  }

  // 8. both known, no amount relation, I undefined
  return { status: "coherent", reasons: [] };
}

export function normalizeTaxSummary(
  summary: ExtractedTaxSummary,
  amountYen?: number,
): ExtractedTaxSummary {
  const consistency = reconcileTaxSummary({ amountYen, summary });

  if (consistency.status === "reconcilable") {
    const normalized: ExtractedTaxSummary = { ...summary };
    if (consistency.reasons.includes("reconciled_to_included")) {
      normalized.taxMode = "included";
      normalized.taxableAmountBasis = "tax_included";
    } else if (consistency.reasons.includes("reconciled_to_external")) {
      normalized.taxMode = "external";
      normalized.taxableAmountBasis = "tax_excluded";
    }
    const finalConsistency = reconcileTaxSummary({
      amountYen,
      summary: normalized,
    });
    normalized.status = finalConsistency.status;
    normalized.reasons = finalConsistency.reasons;
    return normalized;
  }

  return {
    ...summary,
    status: consistency.status,
    reasons: consistency.reasons,
  };
}

export function validateTaxSummaryConsistency({
  amountYen,
  taxSummaries,
}: {
  amountYen: number;
  taxSummaries: ExtractedTaxSummary[];
}): ExtractedTaxSummary[] {
  return taxSummaries.map((summary) =>
    normalizeTaxSummary(summary, taxSummaries.length === 1 ? amountYen : undefined),
  );
}
