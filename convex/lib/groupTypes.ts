import type { Id } from "../_generated/dataModel";

export type GroupMembership = {
  membershipId: Id<"groupMembers">;
  groupId: Id<"groups">;
  userId: string;
  role: "owner" | "member";
};

export type GroupDoc = {
  _id: Id<"groups">;
  name: string;
  clerkOrganizationId?: string;
  status?: "active" | "deleted" | "archived";
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type UserDoc = {
  _id: Id<"users">;
  activeGroupId?: Id<"groups">;
};

export type GroupMemberListItem = {
  userId: string;
  role: "owner" | "member";
  displayName: string;
  email: string | null;
  isActiveGroup: boolean;
  createdAt: number;
};

export type GroupPendingInvitationListItem = {
  _id: Id<"groupInvitations">;
  email: string;
  status: "pending";
  createdAt: number;
};
