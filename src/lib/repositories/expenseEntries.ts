import { api } from "../../../convex/_generated/api";

export const createExpenseEntriesApi = () => api.expenseEntries.mutations.createExpenseEntries;
export const createIncomeEntryApi = () => api.expenseEntries.mutations.createIncomeEntry;
export const deleteExpenseEntryApi = () => api.expenseEntries.mutations.deleteExpenseEntry;
export const updateExpenseEntryApi = () => api.expenseEntries.mutations.updateExpenseEntry;
export const bulkUpdateSpendingCategoriesApi = () =>
  api.expenseEntries.mutations.bulkUpdateSpendingCategories;
export const bulkDeleteSpendingRecordsApi = () =>
  api.expenseEntries.mutations.bulkDeleteSpendingRecords;
