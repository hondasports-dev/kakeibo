import { api } from "../../../convex/_generated/api";

export const getOrCreateCurrentWeekSessionApi = () =>
  api.weekSessions.mutations.getOrCreateCurrentWeekSession;
export const getOrCreateWeekSessionApi = () => api.weekSessions.mutations.getOrCreateWeekSession;
