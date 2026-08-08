import { api } from "../../../convex/_generated/api";

export const acceptInvitationApi = () => api.groups.clerkInvitations.acceptInvitation;
export const cancelPendingGroupInvitationApi = () =>
  api.groups.clerkInvitations.cancelPendingGroupInvitation;
export const changeMemberRoleApi = () => api.groups.members.changeMemberRole;
export const createGroupApi = () => api.groups.mutations.createGroup;
export const getGroupDeletionPreviewApi = () => api.groups.deletion.getGroupDeletionPreview;
export const getGroupDeletionStatusApi = () => api.groups.deletion.getGroupDeletionStatus;
export const getGroupMembersApi = () => api.groups.queries.getGroupMembers;
export const getMyGroupApi = () => api.groups.queries.getMyGroup;
export const inviteMemberApi = () => api.groups.clerkInvitations.inviteMember;
export const listManagementAuditLogsApi = () => api.groups.auditLogs.listManagementAuditLogs;
export const listMyGroupsApi = () => api.groups.queries.listMyGroups;
export const listPendingGroupInvitationsApi = () => api.groups.queries.listPendingGroupInvitations;
export const removeMemberApi = () => api.groups.members.removeMember;
export const requestGroupDeletionApi = () => api.groups.deletion.requestGroupDeletion;
export const resumeGroupDeletionApi = () => api.groups.deletion.resumeGroupDeletion;
export const setActiveGroupApi = () => api.groups.mutations.setActiveGroup;
export const transferGroupOwnershipApi = () => api.groups.members.transferGroupOwnership;
export const updateGroupNameApi = () => api.groups.mutations.updateGroupName;
