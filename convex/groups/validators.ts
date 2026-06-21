import { v } from "convex/values";

export const groupMemberListItemValidator = v.object({
  userId: v.string(),
  role: v.union(v.literal("owner"), v.literal("member")),
  displayName: v.string(),
  email: v.union(v.string(), v.null()),
  isActiveGroup: v.boolean(),
  createdAt: v.number(),
});

export const groupPendingInvitationListItemValidator = v.object({
  _id: v.id("groupInvitations"),
  email: v.string(),
  status: v.literal("pending"),
  createdAt: v.number(),
});

export const groupDeletionPreviewValidator = v.object({
  groupName: v.string(),
  members: v.number(),
  invitations: v.number(),
  sourceDocuments: v.number(),
  expenseEntries: v.number(),
  receipts: v.number(),
  receiptImages: v.number(),
  categories: v.number(),
  aiDrafts: v.number(),
  aiDraftItems: v.number(),
  analysisBatches: v.number(),
  analysisJobs: v.number(),
  weekSessions: v.number(),
});
