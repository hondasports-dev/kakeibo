import { api } from "../../../convex/_generated/api";

export const createReceiptApi = () => api.receipts.crud.createReceipt;
export const deleteReceiptApi = () => api.receipts.crud.deleteReceipt;
export const getFourWeeksSummaryApi = () => api.receipts.summaries.getFourWeeksSummary;
export const getWeekSummaryApi = () => api.receipts.summaries.getWeekSummary;
export const getWeekSummaryWithCategoriesApi = () =>
  api.receipts.summaries.getWeekSummaryWithCategories;
export const getMonthSummaryWithCategoriesApi = () =>
  api.receipts.summaries.getMonthSummaryWithCategories;
export const getYearSummaryApi = () => api.receipts.summaries.getYearSummary;
export const updateReceiptApi = () => api.receipts.crud.updateReceipt;
