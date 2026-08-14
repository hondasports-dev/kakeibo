import { api } from "../../../convex/_generated/api";

export const getGroupDetailApi = () => api.systemAdminSearch.getGroupDetail;
export const getMySystemAdminContextApi = () => api.systemAdmins.getMySystemAdminContext;
export const getUserDetailApi = () => api.systemAdminSearch.getUserDetail;
export const grantSystemAdminApi = () => api.systemAdmins.grantSystemAdmin;
export const listGroupDeletionJobsApi = () => api.systemAdminGroupDeletion.listGroupDeletionJobs;
export const listSystemAdminAuditLogsApi = () => api.systemAdmins.listSystemAdminAuditLogs;
export const listSystemAdminsApi = () => api.systemAdmins.listSystemAdmins;
export const recoverOwnerlessGroupApi = () =>
  api.systemAdminOwnerlessGroupRecovery.recoverOwnerlessGroup;
export const resumeGroupDeletionApi = () => api.systemAdminGroupDeletion.resumeGroupDeletion;
export const revokeSystemAdminApi = () => api.systemAdmins.revokeSystemAdmin;
export const searchGroupsApi = () => api.systemAdminSearch.searchGroups;
export const searchUsersApi = () => api.systemAdminSearch.searchUsers;
export const systemAdminMembershipOperationApi = () =>
  api.systemAdminMembership.systemAdminMembershipOperation;
export const systemAdminPendingInvitationRevokeApi = () =>
  api.systemAdminPendingInvitationAction.systemAdminPendingInvitationRevoke;
export const systemAdminRoleOperationApi = () =>
  api.systemAdminRoleOperations.systemAdminRoleOperation;
