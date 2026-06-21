import { query } from "../_generated/server";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import {
  groupMemberListItemValidator,
  groupPendingInvitationListItemValidator,
} from "./validators";
import type { GroupDoc } from "../lib/groupTypes";
import { dedupePendingGroupInvitationsByEmail } from "../lib/groupEmailMatching";
import { readQueryDoc, readQueryDocs } from "../lib/groupQueryHelpers";
import { sortGroupMembersForDisplay } from "./memberDisplay";
import {
  getGroupMembership,
  getResolvedMemberships,
  requireGroupMembership,
  requireGroupOwner,
} from "./membership";

export async function getMyGroupHandler(ctx: QueryCtx) {
  const membership = await getGroupMembership(ctx);
  if (membership === null) return null;

  const group = await ctx.db.get(membership.groupId);
  if (group === null) return null;

  return {
    _id: group._id,
    name: group.name,
    clerkOrganizationId: group.clerkOrganizationId ?? null,
    role: membership.role,
    createdAt: group.createdAt,
  };
}

export async function listMyGroupsHandler(ctx: QueryCtx) {
  const { memberships, activeMembership } = await getResolvedMemberships(ctx);
  if (memberships.length === 0) return [];

  const groups = await Promise.all(
    memberships.map(async (membership) => {
      const group = (await ctx.db.get(membership.groupId)) as GroupDoc | null;
      if (group === null) return null;
      return {
        _id: group._id,
        name: group.name,
        clerkOrganizationId: group.clerkOrganizationId ?? null,
        role: membership.role,
        createdAt: group.createdAt,
        isActive: activeMembership?.groupId === group._id,
      };
    }),
  );

  return groups.filter((group): group is NonNullable<typeof group> => group !== null);
}

export async function getGroupMembersHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupMembership(ctx);

  const memberQuery = ctx.db
    .query("groupMembers")
    .withIndex("by_group_id", (q) => q.eq("groupId", groupId));
  const members = await readQueryDocs(memberQuery);

  const membersWithInfo = await Promise.all(
    members.map(async (m) => {
      const user = await readQueryDoc(
        ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", m.userId)),
      );
      return {
        userId: m.userId,
        role: m.role,
        displayName: user?.displayName ?? "ユーザー",
        email: user?.email ?? null,
        isActiveGroup: user?.activeGroupId === groupId,
        createdAt: m.createdAt,
      };
    }),
  );

  return sortGroupMembersForDisplay(membersWithInfo);
}

export async function listPendingGroupInvitationsHandler(ctx: QueryCtx) {
  const { groupId } = await requireGroupOwner(ctx);

  const invitationQuery = ctx.db
    .query("groupInvitations")
    .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId).eq("status", "pending"));
  const invitations = await readQueryDocs(invitationQuery);

  return dedupePendingGroupInvitationsByEmail(
    invitations.map((invitation) => ({
      _id: invitation._id,
      email: invitation.email,
      status: "pending" as const,
      createdAt: invitation.createdAt,
    })),
  );
}

export const getMyGroup = query({
  args: {},
  handler: getMyGroupHandler,
});

export const listMyGroups = query({
  args: {},
  handler: listMyGroupsHandler,
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
