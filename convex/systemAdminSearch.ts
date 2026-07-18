import { paginationResultValidator, paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { action, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireSystemAdmin } from "./systemAdmins";

const DETAIL_LIST_LIMIT = 50;
const MAX_SEARCH_QUERY_LENGTH = 200;
const MAX_SEARCH_PAGE_SIZE = 100;

const systemAdminEnvironmentValidator = v.union(
  v.literal("development"),
  v.literal("preview"),
  v.literal("production"),
);
const userSearchTypeValidator = v.union(
  v.literal("displayName"),
  v.literal("email"),
  v.literal("userId"),
);
const groupSearchTypeValidator = v.union(v.literal("name"), v.literal("groupId"));

const userListItemValidator = v.object({
  id: v.id("users"),
  userId: v.string(),
  displayName: v.string(),
  email: v.union(v.string(), v.null()),
  activeGroupId: v.union(v.id("groups"), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const groupListItemValidator = v.object({
  id: v.id("groups"),
  name: v.string(),
  status: v.union(
    v.literal("active"),
    v.literal("deleting"),
    v.literal("deleted"),
    v.literal("archived"),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const userSearchResultValidator = v.object({
  environment: systemAdminEnvironmentValidator,
  ...paginationResultValidator(userListItemValidator).fields,
});
const groupSearchResultValidator = v.object({
  environment: systemAdminEnvironmentValidator,
  ...paginationResultValidator(groupListItemValidator).fields,
});
const userMembershipValidator = v.object({
  groupId: v.id("groups"),
  groupName: v.string(),
  role: v.union(v.literal("owner"), v.literal("member")),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const userInvitationValidator = v.object({
  id: v.id("groupInvitations"),
  groupId: v.id("groups"),
  groupName: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("revoked"),
    v.literal("expired"),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const userDetailValidator = v.object({
  ...userListItemValidator.fields,
  environment: systemAdminEnvironmentValidator,
  memberships: v.array(userMembershipValidator),
  invitations: v.array(userInvitationValidator),
  membershipsTruncated: v.boolean(),
  invitationsTruncated: v.boolean(),
});
const groupMemberValidator = v.object({
  userDocumentId: v.union(v.id("users"), v.null()),
  userId: v.string(),
  displayName: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  role: v.union(v.literal("owner"), v.literal("member")),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const groupInvitationValidator = v.object({
  id: v.id("groupInvitations"),
  email: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("revoked"),
    v.literal("expired"),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const groupDetailValidator = v.object({
  ...groupListItemValidator.fields,
  environment: systemAdminEnvironmentValidator,
  members: v.array(groupMemberValidator),
  invitations: v.array(groupInvitationValidator),
  membersTruncated: v.boolean(),
  invitationsTruncated: v.boolean(),
});

type UserSearchType = "displayName" | "email" | "userId";
type GroupSearchType = "name" | "groupId";
type AppEnvironment = "development" | "preview" | "production";
type UserSearchResult = Infer<typeof userSearchResultValidator>;
type GroupSearchResult = Infer<typeof groupSearchResultValidator>;
type UserDetail = Infer<typeof userDetailValidator>;
type GroupDetail = Infer<typeof groupDetailValidator>;

function getSystemAdminEnvironment(): AppEnvironment {
  const environment = process.env.APP_ENV;
  if (environment === undefined || environment === "development") return "development";
  if (environment === "preview" || environment === "production") return environment;
  throw new ConvexError("APP_ENVが正しく設定されていません");
}

function validatePagination(numItems: number) {
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

function mapUser(user: {
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

function mapGroup(group: {
  _id: Id<"groups">;
  name: string;
  status?: "active" | "deleting" | "deleted" | "archived";
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

export const searchUsersData = internalMutation({
  args: {
    queryType: userSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: userSearchResultValidator,
  handler: async (ctx, args) => {
    const { user } = await requireSystemAdmin(ctx);
    validatePagination(args.paginationOpts.numItems);
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
    const response = {
      environment: getSystemAdminEnvironment(),
      ...result,
      page: result.page.map(mapUser),
    };
    await insertSearchAudit(ctx, {
      action: "system_admin_user_searched",
      actorUserId: user._id,
      targetKind: "user",
      queryType: userAuditQueryType(args.queryType),
      queryHash: await hashSearchQuery(args.query),
      resultCount: response.page.length,
    });
    return response;
  },
});

export const searchGroupsData = internalMutation({
  args: {
    queryType: groupSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: groupSearchResultValidator,
  handler: async (ctx, args) => {
    const { user } = await requireSystemAdmin(ctx);
    validatePagination(args.paginationOpts.numItems);
    const searchQuery = normalizeSearchQuery(args.query);
    if (args.queryType === "groupId") {
      const groupId = ctx.db.normalizeId("groups", searchQuery);
      const group = groupId === null ? null : await ctx.db.get(groupId);
      const response = {
        environment: getSystemAdminEnvironment(),
        page: args.paginationOpts.cursor === null && group !== null ? [mapGroup(group)] : [],
        isDone: true,
        continueCursor: args.paginationOpts.cursor ?? "",
      };
      await insertSearchAudit(ctx, {
        action: "system_admin_group_searched",
        actorUserId: user._id,
        targetKind: "group",
        queryType: groupAuditQueryType(args.queryType),
        queryHash: await hashSearchQuery(args.query),
        resultCount: response.page.length,
      });
      return response;
    }
    const result = await ctx.db
      .query("groups")
      .withSearchIndex("search_name", (q) => q.search("name", searchQuery))
      .paginate(args.paginationOpts);
    const response = {
      environment: getSystemAdminEnvironment(),
      ...result,
      page: result.page.map(mapGroup),
    };
    await insertSearchAudit(ctx, {
      action: "system_admin_group_searched",
      actorUserId: user._id,
      targetKind: "group",
      queryType: groupAuditQueryType(args.queryType),
      queryHash: await hashSearchQuery(args.query),
      resultCount: response.page.length,
    });
    return response;
  },
});

export const getUserDetailData = internalMutation({
  args: { userId: v.id("users") },
  returns: v.union(userDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const { user: actorUser } = await requireSystemAdmin(ctx);
    const user = await ctx.db.get(args.userId);
    if (user === null) {
      await insertSearchAudit(ctx, {
        action: "system_admin_user_viewed",
        actorUserId: actorUser._id,
        targetKind: "user",
        targetId: args.userId,
        resultCount: 0,
      });
      return null;
    }
    const membershipRows = await ctx.db
      .query("groupMembers")
      .withIndex("by_user_id", (q) => q.eq("userId", user.userId))
      .take(DETAIL_LIST_LIMIT + 1);
    const invitationRows = user.email
      ? await ctx.db
          .query("groupInvitations")
          .withIndex("by_email", (q) => q.eq("email", user.email!))
          .take(DETAIL_LIST_LIMIT + 1)
      : [];
    const memberships = (
      await Promise.all(
        membershipRows.slice(0, DETAIL_LIST_LIMIT).map(async (membership) => {
          const group = await ctx.db.get(membership.groupId);
          return group
            ? {
                groupId: group._id,
                groupName: group.name,
                role: membership.role,
                createdAt: membership.createdAt,
                updatedAt: membership.updatedAt,
              }
            : null;
        }),
      )
    ).filter((membership): membership is NonNullable<typeof membership> => membership !== null);
    const invitations = (
      await Promise.all(
        invitationRows.slice(0, DETAIL_LIST_LIMIT).map(async (invitation) => {
          const group = await ctx.db.get(invitation.groupId);
          return group
            ? {
                id: invitation._id,
                groupId: group._id,
                groupName: group.name,
                status: invitation.status,
                createdAt: invitation.createdAt,
                updatedAt: invitation.updatedAt,
              }
            : null;
        }),
      )
    ).filter((invitation): invitation is NonNullable<typeof invitation> => invitation !== null);
    const response = {
      ...mapUser(user),
      environment: getSystemAdminEnvironment(),
      memberships,
      invitations,
      membershipsTruncated: membershipRows.length > DETAIL_LIST_LIMIT,
      invitationsTruncated: invitationRows.length > DETAIL_LIST_LIMIT,
    };
    await insertSearchAudit(ctx, {
      action: "system_admin_user_viewed",
      actorUserId: actorUser._id,
      targetKind: "user",
      targetId: args.userId,
      resultCount: 1,
    });
    return response;
  },
});

export const getGroupDetailData = internalMutation({
  args: { groupId: v.id("groups") },
  returns: v.union(groupDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const { user: actorUser } = await requireSystemAdmin(ctx);
    const group = await ctx.db.get(args.groupId);
    if (group === null) {
      await insertSearchAudit(ctx, {
        action: "system_admin_group_viewed",
        actorUserId: actorUser._id,
        targetKind: "group",
        targetId: args.groupId,
        resultCount: 0,
      });
      return null;
    }
    const memberRows = await ctx.db
      .query("groupMembers")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
      .take(DETAIL_LIST_LIMIT + 1);
    const invitationRows = await ctx.db
      .query("groupInvitations")
      .withIndex("by_group_id", (q) => q.eq("groupId", args.groupId))
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
    const response = {
      ...mapGroup(group),
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
    await insertSearchAudit(ctx, {
      action: "system_admin_group_viewed",
      actorUserId: actorUser._id,
      targetKind: "group",
      targetId: args.groupId,
      resultCount: 1,
    });
    return response;
  },
});

type SearchAuditAction =
  | "system_admin_user_searched"
  | "system_admin_group_searched"
  | "system_admin_user_viewed"
  | "system_admin_group_viewed";
type SearchAuditTargetKind = "user" | "group";
type SearchAuditQueryType =
  | "user_display_name"
  | "user_email"
  | "user_id"
  | "group_name"
  | "group_id";

async function insertSearchAudit(
  ctx: MutationCtx,
  args: {
    action: SearchAuditAction;
    actorUserId: Id<"users">;
    targetKind: SearchAuditTargetKind;
    targetId?: string;
    queryType?: SearchAuditQueryType;
    queryHash?: string;
    resultCount?: number;
  },
) {
  await ctx.db.insert("systemAdminAuditLogs", {
    action: args.action,
    actorType: "system_admin",
    actorUserId: args.actorUserId,
    targetKind: args.targetKind,
    ...(args.targetKind === "user" && args.targetId
      ? { targetUserId: args.targetId as Id<"users"> }
      : {}),
    ...(args.targetId ? { targetId: args.targetId } : {}),
    ...(args.queryType ? { queryType: args.queryType } : {}),
    ...(args.queryHash ? { queryHash: args.queryHash } : {}),
    ...(args.resultCount !== undefined ? { resultCount: args.resultCount } : {}),
    createdAt: Date.now(),
  });
}

async function hashSearchQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function userAuditQueryType(queryType: UserSearchType) {
  if (queryType === "displayName") return "user_display_name" as const;
  if (queryType === "email") return "user_email" as const;
  return "user_id" as const;
}

function groupAuditQueryType(queryType: GroupSearchType) {
  return queryType === "name" ? ("group_name" as const) : ("group_id" as const);
}

export const searchUsers = action({
  args: {
    queryType: userSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: userSearchResultValidator,
  handler: async (ctx, args): Promise<UserSearchResult> => {
    const result: UserSearchResult = await ctx.runMutation(
      internal.systemAdminSearch.searchUsersData,
      args,
    );
    return result;
  },
});

export const searchGroups = action({
  args: {
    queryType: groupSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: groupSearchResultValidator,
  handler: async (ctx, args): Promise<GroupSearchResult> => {
    const result: GroupSearchResult = await ctx.runMutation(
      internal.systemAdminSearch.searchGroupsData,
      args,
    );
    return result;
  },
});

export const getUserDetail = action({
  args: { userId: v.id("users") },
  returns: v.union(userDetailValidator, v.null()),
  handler: async (ctx, args): Promise<UserDetail | null> => {
    const result: UserDetail | null = await ctx.runMutation(
      internal.systemAdminSearch.getUserDetailData,
      args,
    );
    return result;
  },
});

export const getGroupDetail = action({
  args: { groupId: v.id("groups") },
  returns: v.union(groupDetailValidator, v.null()),
  handler: async (ctx, args): Promise<GroupDetail | null> => {
    const result: GroupDetail | null = await ctx.runMutation(
      internal.systemAdminSearch.getGroupDetailData,
      args,
    );
    return result;
  },
});
