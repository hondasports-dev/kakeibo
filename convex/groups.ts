import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export { MAX_GROUP_NAME_LENGTH, normalizeGroupName } from "./lib/groupName";

export type { GroupMembership } from "./lib/groupTypes";

export { getGroupMembership, requireGroupMembership, requireGroupOwner } from "./groups/membership";

export { sortGroupMembersForDisplay } from "./groups/memberDisplay";

export {
  getMyGroupHandler,
  listMyGroupsHandler,
  getGroupMembersHandler,
  listPendingGroupInvitationsHandler,
} from "./groups/queries";

export {
  createGroupHandler,
  updateGroupNameHandler,
  setActiveGroupHandler,
} from "./groups/mutations";

export {
  dedupePendingGroupInvitationsByEmail,
  getInvitationEmailKey,
  invitationEmailsMatch,
  invitationEmailsMatchAny,
  sortPendingGroupInvitationsForDisplay,
  revokePendingGroupInvitationsForEmailInGroup,
  cancelPendingGroupInvitationHandler,
  assertEmailCanBeInvitedToGroupHandler,
  createGroupInvitationRecordHandler,
  deletePendingGroupInvitationRecordByTokenHandler,
  acceptGroupInvitationForVerifiedEmailsHandler,
  acceptGroupInvitationHandler,
} from "./groups/invitations";

export {
  addMemberByEmailHandler,
  removeMemberHandler,
  changeMemberRoleHandler,
  transferGroupOwnershipHandler,
} from "./groups/members";

export { getGroupDeletionPreviewHandler, deleteGroupHandler } from "./groups/deletion";

export {
  deleteGroupMembershipsByUserHandler,
  setGroupMemberRoleForE2eHandler,
  seedPendingGroupInvitationForE2eHandler,
  seedGroupMemberForE2eHandler,
  clearGroupInvitationsForE2eHandler,
  getGroupIdByUserIdHandler,
  setGroupClerkOrganizationIdHandler,
  deleteGroupForE2eHandler,
} from "./groups/e2e";

export {
  groupMemberListItemValidator,
  groupPendingInvitationListItemValidator,
  groupDeletionPreviewValidator,
} from "./groups/validators";

import {
  getMyGroupHandler,
  listMyGroupsHandler,
  getGroupMembersHandler,
  listPendingGroupInvitationsHandler,
} from "./groups/queries";
import {
  createGroupHandler,
  updateGroupNameHandler,
  setActiveGroupHandler,
} from "./groups/mutations";
import {
  cancelPendingGroupInvitationHandler,
  assertEmailCanBeInvitedToGroupHandler,
  createGroupInvitationRecordHandler,
  deletePendingGroupInvitationRecordByTokenHandler,
  acceptGroupInvitationForVerifiedEmailsHandler,
  acceptGroupInvitationHandler,
} from "./groups/invitations";
import {
  addMemberByEmailHandler,
  removeMemberHandler,
  changeMemberRoleHandler,
  transferGroupOwnershipHandler,
} from "./groups/members";
import { getGroupDeletionPreviewHandler, deleteGroupHandler } from "./groups/deletion";
import {
  deleteGroupMembershipsByUserHandler,
  setGroupMemberRoleForE2eHandler,
  seedPendingGroupInvitationForE2eHandler,
  seedGroupMemberForE2eHandler,
  clearGroupInvitationsForE2eHandler,
  getGroupIdByUserIdHandler,
  setGroupClerkOrganizationIdHandler,
  deleteGroupForE2eHandler,
} from "./groups/e2e";
import {
  groupMemberListItemValidator,
  groupPendingInvitationListItemValidator,
  groupDeletionPreviewValidator,
} from "./groups/validators";

export const getMyGroup = query({
  args: {},
  handler: getMyGroupHandler,
});

export const listMyGroups = query({
  args: {},
  handler: listMyGroupsHandler,
});

export const createGroup = mutation({
  args: { name: v.string() },
  returns: v.id("groups"),
  handler: createGroupHandler,
});

export const updateGroupName = mutation({
  args: { name: v.string() },
  returns: v.id("groups"),
  handler: updateGroupNameHandler,
});

export const getGroupMembers = query({
  args: {},
  returns: v.array(groupMemberListItemValidator),
  handler: getGroupMembersHandler,
});

export const listPendingGroupInvitations = query({
  args: {},
  returns: v.array(groupPendingInvitationListItemValidator),
  handler: listPendingGroupInvitationsHandler,
});

export const cancelPendingGroupInvitation = mutation({
  args: { invitationId: v.id("groupInvitations") },
  returns: v.object({ clerkInvitationIds: v.array(v.string()) }),
  handler: cancelPendingGroupInvitationHandler,
});

export const addMemberByEmail = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: addMemberByEmailHandler,
});

export const setActiveGroup = mutation({
  args: { groupId: v.id("groups") },
  returns: v.id("groups"),
  handler: setActiveGroupHandler,
});

export const deleteGroupMembershipsByUser = internalMutation({
  args: { userId: v.string() },
  handler: deleteGroupMembershipsByUserHandler,
});

export const setGroupMemberRoleForE2e = internalMutation({
  args: {
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("member")),
  },
  handler: setGroupMemberRoleForE2eHandler,
});

export const seedPendingGroupInvitationForE2e = internalMutation({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
    invitedByUserId: v.string(),
  },
  returns: v.id("groupInvitations"),
  handler: seedPendingGroupInvitationForE2eHandler,
});

export const seedGroupMemberForE2e = internalMutation({
  args: {
    groupId: v.id("groups"),
    displayName: v.string(),
    email: v.string(),
  },
  returns: v.object({
    memberUserId: v.string(),
  }),
  handler: seedGroupMemberForE2eHandler,
});

export const clearGroupInvitationsForE2e = internalMutation({
  args: { groupId: v.id("groups") },
  returns: v.object({ deletedCount: v.number() }),
  handler: clearGroupInvitationsForE2eHandler,
});

export const getGroupIdByUserId = internalQuery({
  args: { userId: v.string() },
  handler: getGroupIdByUserIdHandler,
});

export const assertEmailCanBeInvitedToGroup = internalQuery({
  args: { groupId: v.id("groups"), email: v.string() },
  handler: assertEmailCanBeInvitedToGroupHandler,
});

export const createGroupInvitationRecord = internalMutation({
  args: {
    groupId: v.id("groups"),
    email: v.string(),
    token: v.string(),
    invitedByUserId: v.string(),
    clerkInvitationId: v.optional(v.string()),
  },
  handler: createGroupInvitationRecordHandler,
});

export const deletePendingGroupInvitationRecordByToken = internalMutation({
  args: { token: v.string() },
  handler: deletePendingGroupInvitationRecordByTokenHandler,
});

export const setGroupClerkOrganizationId = internalMutation({
  args: { groupId: v.id("groups"), clerkOrganizationId: v.string() },
  handler: setGroupClerkOrganizationIdHandler,
});

export const acceptGroupInvitation = mutation({
  args: { token: v.string() },
  returns: v.id("groups"),
  handler: acceptGroupInvitationHandler,
});

export const acceptGroupInvitationForVerifiedEmails = internalMutation({
  args: {
    token: v.string(),
    acceptedUserId: v.string(),
    acceptedEmails: v.array(v.string()),
  },
  handler: acceptGroupInvitationForVerifiedEmailsHandler,
});

export const removeMember = mutation({
  args: { targetUserId: v.string() },
  returns: v.null(),
  handler: removeMemberHandler,
});

export const changeMemberRole = mutation({
  args: {
    targetUserId: v.string(),
    newRole: v.union(v.literal("owner"), v.literal("member")),
  },
  returns: v.null(),
  handler: changeMemberRoleHandler,
});

export const transferGroupOwnership = mutation({
  args: { targetUserId: v.string() },
  returns: v.null(),
  handler: transferGroupOwnershipHandler,
});

export const getGroupDeletionPreview = query({
  args: {},
  returns: groupDeletionPreviewValidator,
  handler: getGroupDeletionPreviewHandler,
});

export const deleteGroup = mutation({
  args: { confirmationGroupName: v.string() },
  returns: v.null(),
  handler: deleteGroupHandler,
});

export const deleteGroupForE2e = internalMutation({
  args: { groupId: v.id("groups") },
  handler: deleteGroupForE2eHandler,
});
