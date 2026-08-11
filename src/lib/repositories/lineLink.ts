import { api } from "../../../convex/_generated/api";

export const completeLineLinkApi = () => api.lineLink.actions.complete;
export const getLineLinkStatusApi = () => api.lineLink.queries.getStatus;
export const startLineLinkApi = () => api.lineLink.actions.start;
export const unlinkLineLinkApi = () => api.lineLink.mutations.unlink;
