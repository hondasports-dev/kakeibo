import type {
  AmountBasis,
  ExtractedReceiptItem,
  ExtractedTaxSummary,
  PriceTaxTreatment,
  ReceiptTaxAmountDecision,
  ReceiptTaxDecision,
  ReceiptTaxDecisionCandidate,
  ReceiptTaxDecisionSource,
  ReceiptTaxInput,
  RoundingMethod,
  TaxRateComposition,
  TaxRatePercent,
} from "./types";
import type { ReceiptLineClassification, ReceiptRawObservationLine } from "../observations";
import { canonicalTaxSummaryStatus } from "./taxSummaryConsistency";

type AxisEvidence<TValue> = {
  value: TValue;
  source: ReceiptTaxDecisionSource;
  evidence: string[];
};

const SOURCE_PRIORITY: ReceiptTaxDecisionSource[] = [
  "user",
  "explicitLabel",
  "marker",
  "position",
  "reconciliation",
  "ai",
];

const BUSINESS_ATTRIBUTE_PATTERN =
  /(?:免税事業者|適格請求書発行事業者ではない|インボイス(?:未登録|非登録)|登録番号なし)/;
const INCLUDED_LABEL_PATTERN = /(?:税込|内税|税を含む)/;
const EXCLUDED_LABEL_PATTERN = /(?:税抜|外税|税別)/;
const TAX_AMOUNT_LABEL_PATTERN = /(?:消費税(?!\s*率)(?:額|計)?|税額|内税額|外税額|税合計)/;
const EXCLUDED_STRUCTURAL_ROLES = new Set([
  "itemDiscount",
  "receiptDiscount",
  "coupon",
  "pointsUsed",
  "fee",
  "paymentMethodAmount",
  "cashReceived",
  "change",
]);
const EXCLUDED_RAW_ROLES = new Set(["discount", "payment", "change"]);

function hasExcludedClassificationRole(classification: ReceiptLineClassification) {
  const candidates =
    classification.status === "ambiguous"
      ? classification.candidates
      : classification.candidates.slice(0, 1);
  return candidates.some((candidate) => EXCLUDED_STRUCTURAL_ROLES.has(candidate.role));
}

function isNonTaxEvidenceLine(
  line: ReceiptRawObservationLine,
  classification: ReceiptLineClassification | undefined,
) {
  const classifiedRole = classification?.candidates[0]?.role;
  if (classification?.status === "ambiguous") {
    return (
      line.lineRoleCandidates.some((role) => EXCLUDED_RAW_ROLES.has(role)) ||
      hasExcludedClassificationRole(classification)
    );
  }
  return classifiedRole === undefined
    ? line.lineRoleCandidates.some((role) => EXCLUDED_RAW_ROLES.has(role))
    : EXCLUDED_STRUCTURAL_ROLES.has(classifiedRole);
}

function sourceRank(source: ReceiptTaxDecisionSource) {
  return SOURCE_PRIORITY.indexOf(source);
}

function knownBases(items: ExtractedReceiptItem[]) {
  return new Set<AmountBasis>(items.map((item) => item.amountBasis));
}

function treatmentFromBases(bases: Set<AmountBasis>): PriceTaxTreatment {
  if (bases.has("unknown")) return "unknown";
  const included = bases.has("tax_included");
  const excluded = bases.has("tax_excluded");
  if (included && excluded) return "perItem";
  if (included) return "included";
  if (excluded) return "excluded";
  return "unknown";
}

function compositionFromRates(rates: Iterable<TaxRatePercent | null>): TaxRateComposition {
  const known = new Set([...rates].filter((rate): rate is 8 | 10 => rate === 8 || rate === 10));
  if (known.has(8) && known.has(10)) return "mixed";
  if (known.has(8)) return "rate8";
  if (known.has(10)) return "rate10";
  return "unknown";
}

function explicitLabelEvidence(input: ReceiptTaxInput) {
  const classificationByIndex = new Map(
    (input.receiptLineClassifications ?? []).map((classification) => [
      classification.sourceLineIndex,
      classification,
    ]),
  );
  const usableLines = (input.rawObservationLines ?? []).filter((line) => {
    if (BUSINESS_ATTRIBUTE_PATTERN.test(line.rawText)) return false;
    return !isNonTaxEvidenceLine(line, classificationByIndex.get(line.sourceLineIndex));
  });
  const text = usableLines.map((line) => line.rawText.normalize("NFKC")).join("\n");
  const included = INCLUDED_LABEL_PATTERN.test(text);
  const excluded = EXCLUDED_LABEL_PATTERN.test(text);
  const treatment: PriceTaxTreatment =
    included && excluded ? "perItem" : included ? "included" : excluded ? "excluded" : "unknown";
  const rates = usableLines.flatMap((line) => {
    const normalized = line.rawText.normalize("NFKC");
    return [8, 10].filter((rate): rate is 8 | 10 =>
      new RegExp(`(?:^|\\D)${rate}\\s*%`).test(normalized),
    );
  });
  return {
    treatment,
    composition: compositionFromRates(rates),
    evidence: [
      ...(included ? ["explicit_label:included"] : []),
      ...(excluded ? ["explicit_label:excluded"] : []),
      ...[...new Set(rates)].map((rate) => `explicit_label:rate_${rate}`),
    ],
  };
}

function markerEvidence(input: ReceiptTaxInput): AxisEvidence<TaxRateComposition> | undefined {
  const rates = (input.markerDefinitions ?? []).flatMap((definition) => {
    const normalized = definition.description.normalize("NFKC");
    return [8, 10].filter((rate): rate is 8 | 10 =>
      new RegExp(`(?:^|\\D)${rate}\\s*%`).test(normalized),
    );
  });
  const value = compositionFromRates(rates);
  return value === "unknown"
    ? undefined
    : {
        value,
        source: "marker",
        evidence: [...new Set(rates)].map((rate) => `marker_legend:rate_${rate}`),
      };
}

function positionEvidence(input: ReceiptTaxInput) {
  const rawLineByIndex = new Map(
    (input.rawObservationLines ?? []).map((line) => [line.sourceLineIndex, line]),
  );
  const contextualRates = (input.receiptLineClassifications ?? []).flatMap((classification) => {
    if (
      classification.candidates[0]?.role !== "tax" ||
      !classification.candidates[0].evidence.includes("position:receipt_footer")
    ) {
      return [];
    }
    const text =
      rawLineByIndex.get(classification.sourceLineIndex)?.rawText.normalize("NFKC") ?? "";
    return [
      ...(/軽減(?:税率|税)/.test(text) ? ([8] as const) : []),
      ...(/標準(?:税率|税)/.test(text) ? ([10] as const) : []),
    ];
  });
  const composition = compositionFromRates(contextualRates);
  if (composition === "unknown") return undefined;
  return {
    treatment: "unknown" as const,
    composition,
    evidence: ["position:receipt_footer_tax_rate_context"],
  };
}

function aiAxisEvidence(input: ReceiptTaxInput) {
  const treatment = treatmentFromBases(knownBases(input.items));
  const composition = compositionFromRates([
    ...input.items.map((item) => item.taxRatePercent),
    ...input.taxSummaries.map((summary) => summary.taxRatePercent),
  ]);
  return {
    treatment,
    composition,
    evidence: [
      ...(treatment === "unknown" ? [] : [`ai:treatment_${treatment}`]),
      ...(composition === "unknown" ? [] : [`ai:composition_${composition}`]),
    ],
  };
}

function reconciliationAxisEvidence(input: ReceiptTaxInput) {
  const summariesAreVerified =
    input.taxSummaries.length > 0 &&
    input.taxSummaries.every((summary) => canonicalTaxSummaryStatus(summary.status) === "verified");
  const summaryTotal = input.taxSummaries.reduce((sum, summary) => {
    if (summary.taxableAmountBasis === "tax_included") return sum + summary.taxableAmountYen;
    if (summary.taxableAmountBasis === "tax_excluded") {
      return sum + summary.taxableAmountYen + summary.taxYen;
    }
    return Number.NaN;
  }, 0);
  const itemTreatment = treatmentFromBases(knownBases(input.items));
  const summaryTreatment = treatmentFromBases(
    new Set(input.taxSummaries.map((summary) => summary.taxableAmountBasis)),
  );
  const itemPrintedTotal = input.items.reduce((sum, item) => sum + item.printedAmountYen, 0);
  const itemTotal =
    itemTreatment === "included"
      ? itemPrintedTotal
      : itemTreatment === "excluded"
        ? itemPrintedTotal + input.taxSummaries.reduce((sum, summary) => sum + summary.taxYen, 0)
        : Number.NaN;
  const isFullyReconciled =
    summariesAreVerified &&
    Number.isFinite(summaryTotal) &&
    summaryTotal === input.amountYen &&
    input.items.length > 0 &&
    itemTreatment === summaryTreatment &&
    itemTotal === input.amountYen;
  if (!isFullyReconciled) {
    return {
      treatment: "unknown" as const,
      composition: "unknown" as const,
      evidence: [],
      mismatch:
        summariesAreVerified &&
        ((Number.isFinite(summaryTotal) && summaryTotal !== input.amountYen) ||
          (input.items.length > 0 && Number.isFinite(itemTotal) && itemTotal !== input.amountYen) ||
          (input.items.length > 0 &&
            itemTreatment !== "unknown" &&
            summaryTreatment !== "unknown" &&
            itemTreatment !== summaryTreatment)),
    };
  }
  const treatment = summaryTreatment;
  const composition = compositionFromRates(
    input.taxSummaries.map((summary) => summary.taxRatePercent),
  );
  return {
    treatment,
    composition,
    evidence: [
      ...(treatment === "unknown" ? [] : [`reconciliation:treatment_${treatment}`]),
      ...(composition === "unknown" ? [] : [`reconciliation:composition_${composition}`]),
    ],
    mismatch: false,
  };
}

function arithmeticTreatment(input: ReceiptTaxInput): PriceTaxTreatment {
  const itemBases = knownBases(input.items);
  if (itemBases.has("unknown") && itemBases.size > 1) return "unknown";
  const modes = new Set<PriceTaxTreatment>();
  for (const summary of input.taxSummaries) {
    if (summary.taxableAmountYen === input.amountYen) modes.add("included");
    if (summary.taxableAmountYen + summary.taxYen === input.amountYen) modes.add("excluded");
  }
  if (modes.size !== 1) return "unknown";
  return [...modes][0]!;
}

function chooseAxis<TValue extends string>(
  evidence: AxisEvidence<TValue>[],
  unknown: TValue,
): AxisEvidence<TValue> {
  const known = evidence.filter((entry) => entry.value !== unknown);
  if (known.length === 0) return { value: unknown, source: "ai", evidence: [] };
  return [...known].sort((left, right) => sourceRank(left.source) - sourceRank(right.source))[0]!;
}

function estimateTax(summary: ExtractedTaxSummary): number | undefined {
  if (summary.taxRatePercent !== 8 && summary.taxRatePercent !== 10) return undefined;
  const round = (value: number) => {
    switch (summary.roundingMethod) {
      case "floor":
        return Math.floor(value);
      case "ceil":
        return Math.ceil(value);
      case "round":
      case "unknown":
        return Math.round(value);
    }
  };
  if (summary.taxableAmountBasis === "tax_excluded") {
    return Math.max(0, round((summary.taxableAmountYen * summary.taxRatePercent) / 100));
  }
  if (summary.taxableAmountBasis === "tax_included") {
    return Math.max(
      0,
      round((summary.taxableAmountYen * summary.taxRatePercent) / (100 + summary.taxRatePercent)),
    );
  }
  return undefined;
}

function resolveRoundingMethod(summaries: ExtractedTaxSummary[]): RoundingMethod {
  const methods = new Set(summaries.map((summary) => summary.roundingMethod));
  return methods.size === 1 ? [...methods][0]! : "unknown";
}

function taxAmountDecision(input: ReceiptTaxInput): {
  decision: ReceiptTaxAmountDecision;
  conflictingPrintedLines: boolean;
  dependsOnUnverifiedSummary: boolean;
} {
  const classificationByIndex = new Map(
    (input.receiptLineClassifications ?? []).map((classification) => [
      classification.sourceLineIndex,
      classification,
    ]),
  );
  const printedLines = (input.rawObservationLines ?? []).flatMap((line) => {
    const classification = classificationByIndex.get(line.sourceLineIndex);
    const normalized = line.rawText.normalize("NFKC");
    const classifiedRole = classification?.candidates[0]?.role;
    const isTaxAmount =
      !isNonTaxEvidenceLine(line, classification) &&
      (classifiedRole === undefined || classifiedRole === "tax") &&
      TAX_AMOUNT_LABEL_PATTERN.test(normalized) &&
      !/(?:対象|小計)/.test(normalized);
    return isTaxAmount && line.amountYen !== null
      ? [{ amountYen: line.amountYen, normalized }]
      : [];
  });
  const roundingMethod = resolveRoundingMethod(input.taxSummaries);
  if (printedLines.length > 0) {
    const grandTotals = printedLines.filter((line) =>
      /(?:税額?合計|消費税(?:合計|計))/.test(line.normalized),
    );
    const rateDetails = printedLines.filter(
      (line) =>
        !grandTotals.includes(line) &&
        /(?:^|\D)(?:8|10)\s*%|軽減(?:税率|税)|標準(?:税率|税)/.test(line.normalized),
    );
    const genericDetails = printedLines.filter(
      (line) => !grandTotals.includes(line) && !rateDetails.includes(line),
    );
    const uniqueGrandTotals = [...new Set(grandTotals.map((line) => line.amountYen))];
    const rateDetailTotal = rateDetails.reduce((sum, line) => sum + line.amountYen, 0);
    const printedTaxYen =
      uniqueGrandTotals.length === 1
        ? uniqueGrandTotals[0]!
        : rateDetails.length > 0
          ? rateDetailTotal
          : printedLines.length === 1
            ? printedLines[0]!.amountYen
            : undefined;
    const conflictingPrintedLines =
      uniqueGrandTotals.length > 1 ||
      (uniqueGrandTotals.length === 1 &&
        rateDetails.length > 0 &&
        uniqueGrandTotals[0] !== rateDetailTotal) ||
      (uniqueGrandTotals.length === 1 &&
        genericDetails.some((line) => line.amountYen !== uniqueGrandTotals[0])) ||
      printedTaxYen === undefined;
    return {
      decision: { printedTaxYen, roundingMethod, source: "printed" },
      conflictingPrintedLines,
      dependsOnUnverifiedSummary: false,
    };
  }
  const dependsOnUnverifiedSummary = input.taxSummaries.some(
    (summary) =>
      canonicalTaxSummaryStatus(summary.status) !== "verified" &&
      estimateTax(summary) !== undefined,
  );
  const estimates = input.taxSummaries
    .filter((summary) => canonicalTaxSummaryStatus(summary.status) === "verified")
    .map(estimateTax)
    .filter((value): value is number => value !== undefined);
  return {
    decision:
      estimates.length > 0 && !dependsOnUnverifiedSummary
        ? {
            estimatedTaxYen: estimates.reduce((sum, amount) => sum + amount, 0),
            roundingMethod,
            source: "estimated",
          }
        : { roundingMethod, source: "unknown" },
    conflictingPrintedLines: false,
    dependsOnUnverifiedSummary,
  };
}

function candidate(
  priceTaxTreatment: PriceTaxTreatment,
  taxRateComposition: TaxRateComposition,
  source: ReceiptTaxDecisionSource,
  evidence: string[],
  status: ReceiptTaxDecisionCandidate["resolutionStatus"],
  reasons: string[],
): ReceiptTaxDecisionCandidate {
  return {
    priceTaxTreatment,
    taxRateComposition,
    resolutionStatus: status,
    resolutionSource: source,
    evidence,
    reasons,
  };
}

export function interpretReceiptTaxDecision(input: ReceiptTaxInput): ReceiptTaxDecision {
  const explicit = explicitLabelEvidence(input);
  const marker = markerEvidence(input);
  const ai = aiAxisEvidence(input);
  const reconciliation = reconciliationAxisEvidence(input);
  const arithmetic = arithmeticTreatment(input);
  const position = positionEvidence(input);

  const priceEvidence: AxisEvidence<PriceTaxTreatment>[] = [
    ...(input.userOverride?.priceTaxTreatment !== undefined &&
    input.userOverride.priceTaxTreatment !== "unknown"
      ? [
          {
            value: input.userOverride.priceTaxTreatment,
            source: "user" as const,
            evidence: ["user_override:treatment"],
          },
        ]
      : []),
    ...(explicit.treatment !== "unknown"
      ? [
          {
            value: explicit.treatment,
            source: "explicitLabel" as const,
            evidence: explicit.evidence,
          },
        ]
      : []),
    ...(position?.treatment !== undefined && position.treatment !== "unknown"
      ? [
          {
            value: position.treatment,
            source: "position" as const,
            evidence: position.evidence,
          },
        ]
      : []),
    ...(reconciliation.treatment !== "unknown"
      ? [
          {
            value: reconciliation.treatment,
            source: "reconciliation" as const,
            evidence: reconciliation.evidence,
          },
        ]
      : []),
    ...(ai.treatment !== "unknown"
      ? [{ value: ai.treatment, source: "ai" as const, evidence: ai.evidence }]
      : []),
    ...(arithmetic !== "unknown"
      ? [
          {
            value: arithmetic,
            source: "ai" as const,
            evidence: [`arithmetic:treatment_${arithmetic}`],
          },
        ]
      : []),
  ];
  const rateEvidence: AxisEvidence<TaxRateComposition>[] = [
    ...(input.userOverride?.taxRateComposition !== undefined &&
    input.userOverride.taxRateComposition !== "unknown"
      ? [
          {
            value: input.userOverride.taxRateComposition,
            source: "user" as const,
            evidence: ["user_override:composition"],
          },
        ]
      : []),
    ...(explicit.composition !== "unknown"
      ? [
          {
            value: explicit.composition,
            source: "explicitLabel" as const,
            evidence: explicit.evidence,
          },
        ]
      : []),
    ...(marker ? [marker] : []),
    ...(position?.composition !== undefined
      ? [
          {
            value: position.composition,
            source: "position" as const,
            evidence: position.evidence,
          },
        ]
      : []),
    ...(reconciliation.composition !== "unknown"
      ? [
          {
            value: reconciliation.composition,
            source: "reconciliation" as const,
            evidence: reconciliation.evidence,
          },
        ]
      : []),
    ...(ai.composition !== "unknown"
      ? [{ value: ai.composition, source: "ai" as const, evidence: ai.evidence }]
      : []),
  ];

  const selectedPrice = chooseAxis(priceEvidence, "unknown");
  const selectedRate = chooseAxis(rateEvidence, "unknown");
  const source =
    sourceRank(selectedPrice.source) >= sourceRank(selectedRate.source)
      ? selectedPrice.source
      : selectedRate.source;
  const taxAmountResolution = taxAmountDecision(input);
  const taxAmount = taxAmountResolution.decision;
  const selectedPriceConflicts =
    selectedPrice.source !== "user" &&
    priceEvidence.some(
      (entry) =>
        entry.value !== selectedPrice.value &&
        entry.value !== "unknown" &&
        sourceRank(entry.source) <= sourceRank(selectedPrice.source),
    );
  const selectedRateConflicts =
    selectedRate.source !== "user" &&
    rateEvidence.some(
      (entry) =>
        entry.value !== selectedRate.value &&
        entry.value !== "unknown" &&
        sourceRank(entry.source) <= sourceRank(selectedRate.source),
    );
  const summariesContradict =
    input.taxSummaries.some(
      (summary) => canonicalTaxSummaryStatus(summary.status) === "contradictory",
    ) ||
    reconciliation.mismatch ||
    taxAmountResolution.conflictingPrintedLines;
  const strongSources: ReceiptTaxDecisionSource[] = [
    "user",
    "explicitLabel",
    "marker",
    "position",
    "reconciliation",
  ];
  const axesHavePrimaryEvidence =
    strongSources.includes(selectedPrice.source) && strongSources.includes(selectedRate.source);
  const missingAxis = selectedPrice.value === "unknown" || selectedRate.value === "unknown";
  const estimatedWithUnknownRounding =
    taxAmount.source === "estimated" && taxAmount.roundingMethod === "unknown";
  const reasons = [
    ...(summariesContradict ? ["contradictory_tax_summary"] : []),
    ...(reconciliation.mismatch ? ["receipt_reconciliation_mismatch"] : []),
    ...(taxAmountResolution.conflictingPrintedLines ? ["conflicting_printed_tax_lines"] : []),
    ...(selectedPriceConflicts ? ["conflicting_price_evidence"] : []),
    ...(selectedRateConflicts ? ["conflicting_rate_evidence"] : []),
    ...(missingAxis ? ["unresolved_tax_axis"] : []),
    ...(!axesHavePrimaryEvidence ? ["insufficient_primary_evidence"] : []),
    ...(estimatedWithUnknownRounding ? ["estimated_tax_with_unknown_rounding"] : []),
    ...(taxAmountResolution.dependsOnUnverifiedSummary
      ? ["unverified_tax_summary_for_estimate"]
      : []),
    ...(position ? ["tax_line_in_receipt_footer"] : []),
    ...((input.receiptLineClassifications ?? []).some(hasExcludedClassificationRole) ||
    (input.rawObservationLines ?? []).some((line) =>
      isNonTaxEvidenceLine(
        line,
        (input.receiptLineClassifications ?? []).find(
          (classification) => classification.sourceLineIndex === line.sourceLineIndex,
        ),
      ),
    )
      ? ["non_tax_adjustment_lines_excluded"]
      : []),
  ];
  const status = summariesContradict
    ? "contradictory"
    : missingAxis ||
        !axesHavePrimaryEvidence ||
        estimatedWithUnknownRounding ||
        taxAmountResolution.dependsOnUnverifiedSummary ||
        selectedPriceConflicts ||
        selectedRateConflicts
      ? "ambiguous"
      : "verified";

  const candidates = [
    candidate(
      selectedPrice.value,
      selectedRate.value,
      source,
      [...new Set([...selectedPrice.evidence, ...selectedRate.evidence])],
      status,
      reasons,
    ),
    ...priceEvidence
      .filter(
        (entry) => entry.value !== selectedPrice.value || entry.source !== selectedPrice.source,
      )
      .map((entry) =>
        candidate(entry.value, selectedRate.value, entry.source, entry.evidence, "ambiguous", [
          "lower_priority_alternative",
        ]),
      ),
    ...rateEvidence
      .filter((entry) => entry.value !== selectedRate.value || entry.source !== selectedRate.source)
      .map((entry) =>
        candidate(selectedPrice.value, entry.value, entry.source, entry.evidence, "ambiguous", [
          "lower_priority_alternative",
        ]),
      ),
  ];

  return {
    ...candidates[0]!,
    evidence: [...candidates[0]!.evidence, ...(position ? ["position:tax_footer"] : [])],
    candidates,
    taxAmount,
  };
}
