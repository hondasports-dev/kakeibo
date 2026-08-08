import { api } from "../../../convex/_generated/api";

export const applyReceiptTaxSettingsApi = () =>
  api.aiExpenseDrafts.mutations.applyReceiptTaxSettings;
export const deleteDraftApi = () => api.aiExpenseDrafts.mutations.deleteDraft;
export const getWithItemsApi = () => api.aiExpenseDrafts.queries.getWithItems;
export const listByStatusApi = () => api.aiExpenseDrafts.queries.listByStatus;
export const registerReadyDraftsAsExpenseEntriesApi = () =>
  api.aiExpenseDrafts.mutations.registerReadyDraftsAsExpenseEntries;
export const updateDraftItemTaxOverridesApi = () =>
  api.aiExpenseDrafts.mutations.updateDraftItemTaxOverrides;
export const updateForReviewApi = () => api.aiExpenseDrafts.mutations.updateForReview;
export const updateSummaryTaxOverridesApi = () =>
  api.aiExpenseDrafts.mutations.updateSummaryTaxOverrides;
