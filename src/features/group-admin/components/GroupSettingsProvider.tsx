import { createContext, type ReactNode, useContext } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  cancelPendingGroupInvitationApi,
  changeMemberRoleApi,
  getGroupMembersApi,
  getMyGroupApi,
  inviteMemberApi,
  listManagementAuditLogsApi,
  listMyGroupsApi,
  listPendingGroupInvitationsApi,
  removeMemberApi,
  requestGroupDeletionApi,
  setActiveGroupApi,
  transferGroupOwnershipApi,
  updateGroupNameApi,
} from "../../../lib/repositories/groups";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { GroupMemberListItem } from "../utils/groupMemberDisplay";
import type { GroupPendingInvitationListItem } from "../utils/groupInvitationDisplay";
import type { GroupManagementAuditLogListItem } from "../utils/groupManagementAuditLogDisplay";

export type GroupInfo = {
  _id: Id<"groups">;
  name: string;
  role: "owner" | "member";
  createdAt: number;
};

type GroupListItem = {
  _id: Id<"groups">;
  name: string;
  role: "owner" | "member";
  isActive: boolean;
};

function useGroupSettingsValue() {
  const group = useQuery(getMyGroupApi()) as GroupInfo | null | undefined;
  const groups = useQuery(listMyGroupsApi()) as GroupListItem[] | undefined;
  const members = useQuery(getGroupMembersApi()) as GroupMemberListItem[] | undefined;
  const pendingInvitations = useQuery(
    listPendingGroupInvitationsApi(),
    group?.role === "owner" ? {} : "skip",
  ) as GroupPendingInvitationListItem[] | undefined;
  const managementAuditLogs = useQuery(
    listManagementAuditLogsApi(),
    group?.role === "owner" ? {} : "skip",
  ) as GroupManagementAuditLogListItem[] | undefined;

  return {
    group,
    groups,
    members,
    pendingInvitations,
    managementAuditLogs,
    setActiveGroup: useMutation(setActiveGroupApi()),
    removeMember: useMutation(removeMemberApi()),
    changeMemberRole: useMutation(changeMemberRoleApi()),
    transferGroupOwnership: useMutation(transferGroupOwnershipApi()),
    requestGroupDeletion: useMutation(requestGroupDeletionApi()),
    updateGroupName: useMutation(updateGroupNameApi()),
    inviteMember: useAction(inviteMemberApi()),
    cancelPendingGroupInvitation: useAction(cancelPendingGroupInvitationApi()),
  };
}

type GroupSettingsContextValue = ReturnType<typeof useGroupSettingsValue>;
const GroupSettingsContext = createContext<GroupSettingsContextValue | null>(null);

export function GroupSettingsProvider({ children }: { children: ReactNode }) {
  const value = useGroupSettingsValue();
  return <GroupSettingsContext.Provider value={value}>{children}</GroupSettingsContext.Provider>;
}

export function useGroupSettings() {
  const value = useContext(GroupSettingsContext);
  if (!value) throw new Error("useGroupSettings must be used within GroupSettingsProvider");
  return value;
}

export function useHasGroupSettingsProvider() {
  return useContext(GroupSettingsContext) !== null;
}
