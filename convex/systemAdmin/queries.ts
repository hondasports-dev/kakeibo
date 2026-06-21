import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { requireSystemAdmin } from "./auth";
import {
  getSystemAdminEnvironment,
  groupSearchTypeValidator,
  systemAdminGroupDetailValidator,
  systemAdminGroupSearchResultValidator,
  systemAdminUserDetailValidator,
  systemAdminUserSearchResultValidator,
  userSearchTypeValidator,
} from "./validators";

const DETAIL_LIST_LIMIT = 50;
const MAX_SEARCH_QUERY_LENGTH = 200;
const MAX_SEARCH_PAGE_SIZE = 100;

function validateSearchPageSize(numItems: number) {
  if (!Number.isInteger(numItems) || numItems < 1 || numItems > MAX_SEARCH_PAGE_SIZE) {
    throw new ConvexError("ページ件数は1〜100件で指定してください");
  }
}

function normalizeSearchQuery(query: string) {
  const normalized = query.trim();
  if (normalized.length === 0 || normalized.length > MAX_SEARCH_QUERY_LENGTH) {
    throw new ConvexError("検索語は1〜200文字で入力してください");
  }
  return normalized;
}

function mapUserListItem(user: {
  _id: Id<"users">;
  userId: string;
  displayName: string;
  email?: string;
  activeGroupId?: Id<"groups">;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: user._id,
    userId: user.userId,
    displayName: user.displayName,
    email: user.email ?? null,
    activeGroupId: user.activeGroupId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapGroupListItem(group: {
  _id: Id<"groups">;
  name: string;
  status?: "active" | "deleted" | "archived";
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: group._id,
    name: group.name,
    status: group.status ?? "active",
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export const searchUsersData = internalQuery({
  args: {
    queryType: userSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: systemAdminUserSearchResultValidator,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    validateSearchPageSize(args.paginationOpts.numItems);
    const searchQuery = normalizeSearchQuery(args.query);

    const result =
      args.queryType === "displayName"
        ? await ctx.db
            .query("users")
            .withSearchIndex("search_display_name", (q) => q.search("displayName", searchQuery))
            .paginate(args.paginationOpts)
        : args.queryType === "email"
          ? await ctx.db
              .query("users")
              .withSearchIndex("search_email", (q) => q.search("email", searchQuery.toLowerCase()))
              .paginate(args.paginationOpts)
          : await ctx.db
              .query("users")
              .withIndex("by_token_identifier", (q) => q.eq("userId", searchQuery))
              .paginate(args.paginationOpts);

    return {
      environment: getSystemAdminEnvironment(),
      ...result,
      page: result.page.map(mapUserListItem),
    };
  },
});

export const searchGroupsData = internalQuery({
  args: {
    queryType: groupSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: systemAdminGroupSearchResultValidator,
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    validateSearchPageSize(args.paginationOpts.numItems);
    const searchQuery = normalizeSearchQuery(args.query);

    if (args.queryType === "groupId") {
      const groupId = ctx.db.normalizeId("groups", searchQuery);
      const group = groupId === null ? null : await ctx.db.get(groupId);
      return {
        environment: getSystemAdminEnvironment(),
        page:
          args.paginationOpts.cursor === null && group !== null ? [mapGroupListItem(group)] : [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
      };
    }

    const result = await ctx.db
      .query("groups")
      .withSearchIndex("search_name", (q) => q.search("name", searchQuery))
      .paginate(args.paginationOpts);
    return {
      environment: getSystemAdminEnvironment(),
      ...result,
      page: result.page.map(mapGroupListItem),
    };
  },
});

export const getUserDetailData = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(systemAdminUserDetailValidator, v.null()),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (user === null) return null;

    const membershipRows = await ctx.db
      .query("groupMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", user.userId))
      .take(DETAIL_LIST_LIMIT + 1);
    const invitationRows =
      user.email === undefined
        ? []
        : await ctx.db
            .query("groupInvitations")
            .withIndex("by_email", (q) => q.eq("email", user.email!))
            .take(DETAIL_LIST_LIMIT + 1);

    const memberships = (
      await Promise.all(
        membershipRows.slice(0, DETAIL_LIST_LIMIT).map(async (membership) => {
          const group = await ctx.db.get(membership.groupId);
          if (group === null) return null;
          return {
            groupId: group._id,
            groupName: group.name,
            role: membership.role,
            createdAt: membership.createdAt,
            updatedAt: membership.updatedAt,
          };
        }),
      )
    ).filter((membership) => membership !== null);

    const invitations = (
      await Promise.all(
        invitationRows.slice(0, DETAIL_LIST_LIMIT).map(async (invitation) => {
          const group = await ctx.db.get(invitation.groupId);
          if (group === null) return null;
          return {
            id: invitation._id,
            groupId: group._id,
            groupName: group.name,
            status: invitation.status,
            createdAt: invitation.createdAt,
            updatedAt: invitation.updatedAt,
          };
        }),
      )
    ).filter((invitation) => invitation !== null);

    return {
      ...mapUserListItem(user),
      environment: getSystemAdminEnvironment(),
      memberships,
      invitations,
      membershipsTruncated: membershipRows.length > DETAIL_LIST_LIMIT,
      invitationsTruncated: invitationRows.length > DETAIL_LIST_LIMIT,
    };
  },
});

export const getGroupDetailData = internalQuery({
  args: { groupId: v.id("groups") },
  returns: v.union(systemAdminGroupDetailValidator, v.null()),
  handler: async (ctx, args) => {
    await requireSystemAdmin(ctx);
    const group = await ctx.db.get(args.groupId);
    if (group === null) return null;

    const memberRows = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .take(DETAIL_LIST_LIMIT + 1);
    const invitationRows = await ctx.db
      .query("groupInvitations")
      .withIndex("by_group_id_and_email", (q) => q.eq("groupId", args.groupId))
      .take(DETAIL_LIST_LIMIT + 1);

    const members = await Promise.all(
      memberRows.slice(0, DETAIL_LIST_LIMIT).map(async (membership) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_token_identifier", (q) => q.eq("userId", membership.userId))
          .unique();
        return {
          userDocumentId: user?._id ?? null,
          userId: membership.userId,
          displayName: user?.displayName ?? null,
          email: user?.email ?? null,
          role: membership.role,
          createdAt: membership.createdAt,
          updatedAt: membership.updatedAt,
        };
      }),
    );

    return {
      ...mapGroupListItem(group),
      environment: getSystemAdminEnvironment(),
      members,
      invitations: invitationRows.slice(0, DETAIL_LIST_LIMIT).map((invitation) => ({
        id: invitation._id,
        email: invitation.email,
        status: invitation.status,
        createdAt: invitation.createdAt,
        updatedAt: invitation.updatedAt,
      })),
      membersTruncated: memberRows.length > DETAIL_LIST_LIMIT,
      invitationsTruncated: invitationRows.length > DETAIL_LIST_LIMIT,
    };
  },
});
