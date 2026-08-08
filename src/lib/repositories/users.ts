import { api } from "../../../convex/_generated/api";

export const acceptReceiptImageExternalApiConsentApi = () =>
  api.users.mutations.acceptReceiptImageExternalApiConsent;
export const getAuthenticatedUserIdApi = () => api.users.queries.getAuthenticatedUserId;
export const getReceiptImageConsentApi = () => api.users.queries.getReceiptImageConsent;
export const getUserProfileApi = () => api.users.queries.getUserProfile;
export const updateWeeklyDaysApi = () => api.users.mutations.updateWeeklyDays;
export const upsertUserApi = () => api.users.mutations.upsertUser;
