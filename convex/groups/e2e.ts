import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { deleteAllGroupScopedData } from "../lib/deleteGroupPhysically";
import { normalizeEmail } from "../lib/groupEmailMatching";
import { readQueryDoc, readQueryDocs } from "../lib/groupQueryHelpers";

async function deleteE2eSeededUserByEmailIfExists(ctx: MutationCtx, email: string) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await readQueryDoc(
    ctx.db.query("users").withIndex("by_email", (q) => q.eq("email", normalizedEmail)),
  );
  if (existingUser === null || !existingUser.userId.startsWith("e2e-seed|")) {
    return;
  }

  const memberships = await readQueryDocs(
    ctx.db
      .query("groupMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", existingUser.userId)),
  );
  for (const membership of memberships) {
    await ctx.db.delete(membership._id);
  }
  await ctx.db.delete(existingUser._id);
}

export async function deleteGroupMembershipsByUserHandler(
  ctx: MutationCtx,
  args: { userId: string },
) {
  const { userId } = args;
  const membershipQuery = ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId));
  const memberships = await readQueryDocs(membershipQuery);

  for (const membership of memberships) {
    await ctx.db.delete(membership._id);
  }

  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  if (user !== null) {
    if (userId.startsWith("e2e-seed|")) {
      await ctx.db.delete(user._id);
    } else {
      await ctx.db.patch(user._id, { activeGroupId: undefined, updatedAt: Date.now() });
    }
  }

  return { deletedCount: memberships.length };
}

export async function setGroupMemberRoleForE2eHandler(
  ctx: MutationCtx,
  args: { userId: string; role: "owner" | "member" },
) {
  const { userId, role } = args;
  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  const memberships = await readQueryDocs(
    ctx.db.query("groupMembers").withIndex("by_user_id", (q) => q.eq("userId", userId)),
  );

  if (memberships.length === 0) {
    return { updated: false };
  }

  const activeMembership =
    (user?.activeGroupId
      ? memberships.find((membership) => membership.groupId === user.activeGroupId)
      : undefined) ?? memberships[0];

  if (!activeMembership) {
    return { updated: false };
  }

  await ctx.db.patch(activeMembership._id, {
    role,
    updatedAt: Date.now(),
  });

  return { updated: true };
}

export async function seedPendingGroupInvitationForE2eHandler(
  ctx: MutationCtx,
  args: { groupId: Id<"groups">; email: string; invitedByUserId: string },
) {
  const now = Date.now();
  return await ctx.db.insert("groupInvitations", {
    groupId: args.groupId,
    email: normalizeEmail(args.email),
    token: `e2e-pending-${now}`,
    status: "pending",
    invitedByUserId: args.invitedByUserId,
    createdAt: now,
    updatedAt: now,
  });
}

export async function seedGroupMemberForE2eHandler(
  ctx: MutationCtx,
  args: { groupId: Id<"groups">; displayName: string; email: string },
) {
  await deleteE2eSeededUserByEmailIfExists(ctx, args.email);

  const now = Date.now();
  const memberUserId = `e2e-seed|group-member-${now}`;
  await ctx.db.insert("users", {
    userId: memberUserId,
    displayName: args.displayName,
    email: normalizeEmail(args.email),
    activeGroupId: args.groupId,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("groupMembers", {
    groupId: args.groupId,
    userId: memberUserId,
    role: "member",
    createdAt: now,
    updatedAt: now,
  });
  return { memberUserId };
}

export async function clearGroupInvitationsForE2eHandler(
  ctx: MutationCtx,
  args: { groupId: Id<"groups"> },
) {
  const { groupId } = args;
  const statuses = ["pending", "revoked", "expired", "accepted"] as const;
  let deletedCount = 0;

  for (const status of statuses) {
    const invitations = await readQueryDocs(
      ctx.db
        .query("groupInvitations")
        .withIndex("by_group_id_and_status", (q) => q.eq("groupId", groupId).eq("status", status)),
    );

    for (const invitation of invitations) {
      await ctx.db.delete(invitation._id);
      deletedCount += 1;
    }
  }

  return { deletedCount };
}

export async function getGroupIdByUserIdHandler(ctx: QueryCtx, args: { userId: string }) {
  const { userId } = args;
  const user = await readQueryDoc(
    ctx.db.query("users").withIndex("by_token_identifier", (q) => q.eq("userId", userId)),
  );
  const membershipQuery = ctx.db
    .query("groupMembers")
    .withIndex("by_user_id", (q) => q.eq("userId", userId));
  const memberships = await readQueryDocs(membershipQuery);

  if (memberships.length === 0) return null;
  if (user?.activeGroupId) {
    const active = memberships.find((membership) => membership.groupId === user.activeGroupId);
    if (active) return active.groupId;
  }
  return memberships[0]?.groupId ?? null;
}

export async function setGroupClerkOrganizationIdHandler(
  ctx: MutationCtx,
  args: { groupId: Id<"groups">; clerkOrganizationId: string },
) {
  const { groupId, clerkOrganizationId } = args;
  const group = await ctx.db.get(groupId);
  if (group === null) {
    throw new ConvexError("Group not found");
  }

  await ctx.db.patch(groupId, {
    clerkOrganizationId,
    updatedAt: Date.now(),
  });
}

export async function deleteGroupForE2eHandler(ctx: MutationCtx, args: { groupId: Id<"groups"> }) {
  await deleteAllGroupScopedData(ctx, args.groupId);
}
