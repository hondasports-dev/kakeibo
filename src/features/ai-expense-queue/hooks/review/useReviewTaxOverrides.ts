import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { api } from "../../../../../convex/_generated/api";
import { mapConvexDraftToAiExpenseDraft, mapDraftItemsToReviewItems } from "../../utils/mappers";
import type { AmountBasis } from "../../../../../lib/receiptTax/types";
import type { ReviewItemValues, AiExpenseDraft } from "../../types/types";
import { toUserFacingReviewError } from "../../utils/userFacingErrors";

export function useReviewTaxOverrides({
  selectedReviewDraftId,
  setReviewItems,
  setReviewDraftOverride,
  setReviewError,
}: {
  selectedReviewDraftId: string | null;
  setReviewItems: (items: ReviewItemValues[]) => void;
  setReviewDraftOverride: (draft: AiExpenseDraft) => void;
  setReviewError: (error: string) => void;
}) {
  const [taxUpdatingItemId, setTaxUpdatingItemId] = useState<string | null>(null);
  const taxOverrideRequestIdRef = useRef(0);
  const updateDraftItemTaxOverrides = useMutation(
    api.aiExpenseDrafts.mutations.updateDraftItemTaxOverrides,
  );

  const applyTaxOverride = async (
    itemId: string,
    overrides: {
      taxRatePercent?: 0 | 8 | 10 | null;
      amountBasis?: AmountBasis;
    },
  ) => {
    if (!selectedReviewDraftId) {
      return;
    }
    const requestId = ++taxOverrideRequestIdRef.current;
    setTaxUpdatingItemId(itemId);
    setReviewError("");
    try {
      const result = await updateDraftItemTaxOverrides({
        draftId: selectedReviewDraftId as Id<"aiExpenseDrafts">,
        itemId: itemId as Id<"aiExpenseDraftItems">,
        ...overrides,
      });
      if (requestId !== taxOverrideRequestIdRef.current) {
        return;
      }
      setReviewDraftOverride(mapConvexDraftToAiExpenseDraft(result.draft));
      setReviewItems(mapDraftItemsToReviewItems(result.items));
    } catch (error) {
      if (requestId !== taxOverrideRequestIdRef.current) {
        return;
      }
      setReviewError(toUserFacingReviewError(error));
    } finally {
      if (requestId === taxOverrideRequestIdRef.current) {
        setTaxUpdatingItemId(null);
      }
    }
  };

  return {
    taxUpdatingItemId,
    handleTaxRateChange: (itemId: string, taxRatePercent: 0 | 8 | 10 | null) =>
      void applyTaxOverride(itemId, { taxRatePercent }),
    handleAmountBasisChange: (itemId: string, amountBasis: AmountBasis) =>
      void applyTaxOverride(itemId, { amountBasis }),
  };
}
