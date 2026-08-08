import { api } from "../../../convex/_generated/api";

export const createCategoryApi = () => api.categories.mutations.createCategory;
export const deactivateCategoryApi = () => api.categories.mutations.deactivateCategory;
export const listActiveApi = () => api.categories.queries.listActive;
export const listForSettingsApi = () => api.categories.queries.listForSettings;
export const seedDefaultCategoriesApi = () => api.categories.mutations.seedDefaultCategories;
export const updateCategoryApi = () => api.categories.mutations.updateCategory;
