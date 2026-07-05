import type {
  AmountBasis,
  ExtractedReceiptItem,
  ExtractedTaxSummary,
  TaxContextResolution,
  TaxEvidence,
  TaxRatePercent,
  TaxResolutionSource,
} from "./types";

function resolveBasis(summary: ExtractedTaxSummary): AmountBasis {
  if (summary.taxableAmountBasis !== "unknown") return summary.taxableAmountBasis;
  if (summary.taxMode === "external") return "tax_excluded";
  if (summary.taxMode === "included") return "tax_included";
  return "unknown";
}

function resolved(
  summary: ExtractedTaxSummary,
  source: TaxResolutionSource,
): TaxContextResolution | undefined {
  const amountBasis = resolveBasis(summary);
  if (amountBasis === "unknown") return undefined;
  return { status: "resolved", taxRatePercent: summary.taxRatePercent, amountBasis, source };
}

function itemTotal(items: ExtractedReceiptItem[], indexes: number[]) {
  return indexes.reduce((sum, index) => sum + items[index].printedAmountYen, 0);
}

function findUniqueSubset(
  items: ExtractedReceiptItem[],
  indexes: number[],
  target: number,
): number[] | undefined {
  if (target === 0) return undefined;
  let states = new Map<number, { count: 1 | 2; indexes: number[] }>([
    [0, { count: 1, indexes: [] }],
  ]);
  for (const itemIndex of indexes) {
    const next = new Map(
      [...states].map(([sum, state]) => [sum, { count: state.count, indexes: [...state.indexes] }]),
    );
    for (const [sum, state] of states) {
      const newSum = sum + items[itemIndex].printedAmountYen;
      const existing = next.get(newSum);
      if (!existing) {
        next.set(newSum, { count: state.count, indexes: [...state.indexes, itemIndex] });
      } else {
        next.set(newSum, { count: 2, indexes: [...existing.indexes] });
      }
    }
    if (next.size > 20_000) return undefined;
    states = next;
  }
  const match = states.get(target);
  return match?.count === 1 && match.indexes.length > 0 ? match.indexes : undefined;
}

const PAID_TOTAL_IMPLIED_TAX_TOLERANCE_YEN = 30;

export function resolveTaxContext(args: {
  amountYen: number;
  items: ExtractedReceiptItem[];
  taxSummaries: ExtractedTaxSummary[];
  evidence: TaxEvidence[];
}): TaxContextResolution[] {
  const contexts: TaxContextResolution[] = args.items.map((item) => ({
    status: "unresolved",
    taxRatePercent: item.taxRatePercent,
    amountBasis: item.amountBasis,
    reasons: [],
  }));

  args.items.forEach((item, index) => {
    if (item.taxRatePercent === null) return;
    const matching = args.taxSummaries.filter(
      (summary) => summary.taxRatePercent === item.taxRatePercent,
    );
    const basis = item.amountBasis;
    if (basis !== "unknown") {
      contexts[index] = {
        status: "resolved",
        taxRatePercent: item.taxRatePercent,
        amountBasis: basis,
        source: "item_explicit",
      };
    } else if (matching.length === 1) {
      const context = resolved(matching[0], "summary_reconciliation");
      if (context) contexts[index] = context;
    }
  });

  const markerRates = new Map<number, TaxRatePercent>();
  const conflictedMarkerIndexes = new Set<number>();
  for (const evidence of args.evidence) {
    if (evidence.type !== "marker_legend" || evidence.interpretedTaxRatePercent === undefined)
      continue;
    if (conflictedMarkerIndexes.has(evidence.itemIndex)) continue;
    const previous = markerRates.get(evidence.itemIndex);
    if (previous === undefined || previous === evidence.interpretedTaxRatePercent) {
      markerRates.set(evidence.itemIndex, evidence.interpretedTaxRatePercent);
    } else {
      markerRates.delete(evidence.itemIndex);
      conflictedMarkerIndexes.add(evidence.itemIndex);
    }
  }
  for (const summary of args.taxSummaries) {
    const indexes = args.items
      .map((_, index) => index)
      .filter(
        (index) =>
          contexts[index].status === "unresolved" &&
          markerRates.get(index) === summary.taxRatePercent,
      );
    if (indexes.length === 0 || itemTotal(args.items, indexes) !== summary.taxableAmountYen)
      continue;
    const context = resolved(summary, "marker_reconciled");
    if (context) indexes.forEach((index) => (contexts[index] = context));
  }

  const unresolved = () =>
    args.items.map((_, index) => index).filter((index) => contexts[index].status === "unresolved");
  if (args.taxSummaries.length === 1 && unresolved().length > 0) {
    const indexes = unresolved();
    const resolvedIndexes = args.items
      .map((_, index) => index)
      .filter((index) => contexts[index].status === "resolved");
    const summary = args.taxSummaries[0];
    if (itemTotal(args.items, [...resolvedIndexes, ...indexes]) === summary.taxableAmountYen) {
      const context = resolved(summary, "single_summary");
      if (context) indexes.forEach((index) => (contexts[index] = context));
    }
  }

  let madeProgress = true;
  while (madeProgress && unresolved().length > 0) {
    madeProgress = false;
    const unresolvedIndexes = unresolved();
    const proposals = args.taxSummaries.flatMap((summary) => {
      const alreadyResolved = args.items.reduce((sum, item, index) => {
        const context = contexts[index];
        return context.status === "resolved" && context.taxRatePercent === summary.taxRatePercent
          ? sum + item.printedAmountYen
          : sum;
      }, 0);
      const indexes = findUniqueSubset(
        args.items,
        unresolvedIndexes,
        summary.taxableAmountYen - alreadyResolved,
      );
      return indexes ? [{ summary, indexes }] : [];
    });
    for (const proposal of proposals) {
      const conflicts = proposals.some(
        (other) =>
          other !== proposal && other.indexes.some((index) => proposal.indexes.includes(index)),
      );
      if (conflicts || proposal.indexes.some((index) => contexts[index].status === "resolved")) {
        continue;
      }
      const context = resolved(proposal.summary, "summary_reconciliation");
      if (!context) continue;
      proposal.indexes.forEach((index) => (contexts[index] = context));
      madeProgress = true;
    }
  }

  const unresolvedIndexes = unresolved();
  if (unresolvedIndexes.length > 0) {
    const candidates = args.taxSummaries.filter((summary) => {
      const resolvedTotal = args.items.reduce((sum, item, index) => {
        const context = contexts[index];
        return context.status === "resolved" && context.taxRatePercent === summary.taxRatePercent
          ? sum + item.printedAmountYen
          : sum;
      }, 0);
      return summary.taxableAmountYen - resolvedTotal === itemTotal(args.items, unresolvedIndexes);
    });
    if (candidates.length === 1) {
      const context = resolved(candidates[0], "remaining_summary");
      if (context) unresolvedIndexes.forEach((index) => (contexts[index] = context));
    }
  }

  if (args.taxSummaries.length === 1) {
    const summary = args.taxSummaries[0];
    const printedTotal = args.items.reduce((sum, item) => sum + item.printedAmountYen, 0);
    const impliedTaxYen = args.amountYen - printedTotal;
    const isExternalSummary =
      summary.taxMode === "external" && summary.taxableAmountBasis === "tax_excluded";
    if (
      isExternalSummary &&
      args.amountYen > printedTotal &&
      impliedTaxYen > 0 &&
      Math.abs(impliedTaxYen - summary.taxYen) <= PAID_TOTAL_IMPLIED_TAX_TOLERANCE_YEN
    ) {
      const context = resolved(summary, "paid_total_reconciliation");
      if (context) {
        for (const index of unresolved()) {
          if (args.items[index].printedAmountYen < 0) continue;
          contexts[index] = context;
        }
      }
    }
  }

  return contexts.map((context) => {
    if (context.status === "resolved") return context;
    const reasons = [...context.reasons];
    if (context.taxRatePercent === null) reasons.push("unresolved_tax_rate");
    if (context.amountBasis === "unknown") reasons.push("unresolved_amount_basis");
    return { ...context, reasons };
  });
}
