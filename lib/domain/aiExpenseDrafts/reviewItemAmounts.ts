export type ReviewReplacePreviousItem = {
  amountYen: number;
  printedAmountYen?: number;
  normalizedAmountYen?: number;
  taxResolutionStatus?: "resolved" | "unresolved";
  amountBasis?: "tax_included" | "tax_excluded" | "unknown";
};

export function resolveReviewItemAmountsForReplace(
  submittedAmountYen: number,
  previous: ReviewReplacePreviousItem | undefined,
): {
  amountYen: number;
  printedAmountYen: number;
  normalizedAmountYen?: number;
} {
  if (previous?.taxResolutionStatus === "resolved" && previous.printedAmountYen !== undefined) {
    if (previous.amountBasis === "tax_included") {
      const previousDisplay = previous.normalizedAmountYen ?? previous.amountYen;
      if (submittedAmountYen === previousDisplay) {
        return {
          amountYen: previousDisplay,
          printedAmountYen: previous.printedAmountYen,
          normalizedAmountYen: previous.normalizedAmountYen ?? previousDisplay,
        };
      }
      return {
        amountYen: submittedAmountYen,
        printedAmountYen: submittedAmountYen,
        normalizedAmountYen: submittedAmountYen,
      };
    }

    const previousPrinted = previous.printedAmountYen;
    if (submittedAmountYen === previousPrinted) {
      return {
        amountYen: previous.normalizedAmountYen ?? submittedAmountYen,
        printedAmountYen: previousPrinted,
        normalizedAmountYen: previous.normalizedAmountYen,
      };
    }
    return {
      amountYen: submittedAmountYen,
      printedAmountYen: submittedAmountYen,
      normalizedAmountYen: undefined,
    };
  }

  return {
    amountYen: submittedAmountYen,
    printedAmountYen: submittedAmountYen,
  };
}
