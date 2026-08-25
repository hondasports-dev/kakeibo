import type {
  ExtractedTaxSummary,
  TaxMode,
  TaxSummaryConsistency,
  TaxSummaryConsistencyReason,
  TaxSummaryConsistencyStatus,
} from "./types";

type ReconcileTaxSummaryArgs = {
  amountYen?: number;
  summary: ExtractedTaxSummary;
};

type ResolvedMode = Extract<TaxMode, "included" | "external">;

function resolveReason(reason: ResolvedMode): TaxSummaryConsistencyReason {
  return reason === "included" ? "reconciled_to_included" : "reconciled_to_external";
}

function matchingModes(
  taxableAmountYen: number,
  taxYen: number,
  expectedAmount: number | undefined,
): ResolvedMode[] {
  if (expectedAmount === undefined) return [];
  const modes: ResolvedMode[] = [];
  if (taxableAmountYen === expectedAmount) modes.push("included");
  if (taxableAmountYen + taxYen === expectedAmount) modes.push("external");
  return modes;
}

export function canonicalTaxSummaryStatus(
  status: TaxSummaryConsistencyStatus | undefined,
): "verified" | "ambiguous" | "contradictory" | undefined {
  if (status === undefined) return undefined;
  if (status === "coherent") return "verified";
  if (status === "reconcilable") return "ambiguous";
  if (status === "conflicting") return "contradictory";
  return status;
}

export function isVerifiedTaxSummaryStatus(
  status: TaxSummaryConsistencyStatus | undefined,
): boolean {
  return canonicalTaxSummaryStatus(status) === "verified";
}

export function reconcileTaxSummary({
  amountYen,
  summary,
}: ReconcileTaxSummaryArgs): TaxSummaryConsistency {
  const { taxMode, taxableAmountBasis } = summary;
  const expectedAmount = amountYen ?? summary.taxIncludedAmountYen;
  const modes = matchingModes(summary.taxableAmountYen, summary.taxYen, expectedAmount);

  if (taxMode === "included" && taxableAmountBasis === "tax_excluded") {
    return {
      status: "contradictory",
      reasons: ["included_mode_with_tax_excluded_basis", "tax_summary_amount_mismatch"],
    };
  }
  if (taxMode === "external" && taxableAmountBasis === "tax_included") {
    return {
      status: "contradictory",
      reasons: ["external_mode_with_tax_included_basis", "tax_summary_amount_mismatch"],
    };
  }
  if (taxMode === "mixed") {
    return { status: "ambiguous", reasons: ["mixed_tax_mode"] };
  }

  const declaredMode: ResolvedMode | undefined =
    taxMode === "included" || taxMode === "external" ? taxMode : undefined;
  const basisMode: ResolvedMode | undefined =
    taxableAmountBasis === "tax_included"
      ? "included"
      : taxableAmountBasis === "tax_excluded"
        ? "external"
        : undefined;

  if (declaredMode === undefined || basisMode === undefined) {
    const suggestedMode = modes.length === 1 ? modes[0] : undefined;
    return {
      status: "ambiguous",
      reasons: suggestedMode ? [resolveReason(suggestedMode)] : ["unresolved_tax_summary"],
    };
  }

  if (declaredMode !== basisMode) {
    return {
      status: "contradictory",
      reasons: [
        declaredMode === "included"
          ? "included_mode_with_tax_excluded_basis"
          : "external_mode_with_tax_included_basis",
      ],
    };
  }

  if (
    amountYen !== undefined &&
    summary.taxIncludedAmountYen !== undefined &&
    summary.taxIncludedAmountYen !== amountYen
  ) {
    return { status: "contradictory", reasons: ["tax_included_amount_mismatch"] };
  }

  if (expectedAmount === undefined || modes.includes(declaredMode)) {
    return { status: "verified", reasons: [] };
  }

  const reasons: TaxSummaryConsistencyReason[] = ["tax_summary_amount_mismatch"];
  if (modes.length === 1 && modes[0] !== declaredMode) {
    reasons.push(resolveReason(modes[0]));
    return { status: "contradictory", reasons };
  }

  return {
    status: summary.taxIncludedAmountYen === undefined ? "ambiguous" : "contradictory",
    reasons,
  };
}

export function normalizeTaxSummary(
  summary: ExtractedTaxSummary,
  amountYen?: number,
): ExtractedTaxSummary {
  const consistency = reconcileTaxSummary({ amountYen, summary });
  return {
    ...summary,
    status: consistency.status,
    reasons: consistency.reasons,
  };
}

export function validateTaxSummaryConsistency({
  amountYen,
  taxSummaries,
  resolvableTaxSummaries,
}: {
  amountYen: number;
  taxSummaries: ExtractedTaxSummary[];
  resolvableTaxSummaries?: ExtractedTaxSummary[];
}): ExtractedTaxSummary[] {
  const resolvableSet = new Set(resolvableTaxSummaries ?? taxSummaries);
  const singleResolvable = resolvableSet.size === 1;
  return taxSummaries.map((summary) => {
    if (!resolvableSet.has(summary)) {
      return {
        ...summary,
        status: "contradictory" as const,
        reasons: [...new Set([...(summary.reasons ?? []), "unresolved_tax_summary" as const])],
      };
    }
    return normalizeTaxSummary(summary, singleResolvable ? amountYen : undefined);
  });
}
