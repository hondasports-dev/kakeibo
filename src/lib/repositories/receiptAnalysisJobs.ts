import { api } from "../../../convex/_generated/api";

export const analyzeImageJobApi = () => api.receiptAnalysisJobs.actions.analyzeImageJob;
export const cancelImageJobApi = () => api.receiptAnalysisJobs.mutations.cancelImageJob;
export const createBatchApi = () => api.receiptAnalysisJobs.mutations.createBatch;
export const listJobsApi = () => api.receiptAnalysisJobs.queries.listJobs;
export const retryImageJobApi = () => api.receiptAnalysisJobs.mutations.retryImageJob;
