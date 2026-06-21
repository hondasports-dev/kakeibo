import { paginationOptsValidator } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { action } from "../_generated/server";
import type {
  SystemAdminGroupDetail,
  SystemAdminGroupSearchResult,
  SystemAdminUserDetail,
  SystemAdminUserSearchResult,
} from "./validators";
import {
  groupSearchTypeValidator,
  systemAdminGroupDetailValidator,
  systemAdminGroupSearchResultValidator,
  systemAdminUserDetailValidator,
  systemAdminUserSearchResultValidator,
  userSearchTypeValidator,
} from "./validators";

type PaginationOpts = { numItems: number; cursor: string | null };
type UserSearchArgs = {
  queryType: "displayName" | "email" | "userId";
  query: string;
  paginationOpts: PaginationOpts;
};
type GroupSearchArgs = {
  queryType: "name" | "groupId";
  query: string;
  paginationOpts: PaginationOpts;
};
type AuditArgs = {
  action:
    | "system_admin_user_searched"
    | "system_admin_group_searched"
    | "system_admin_user_viewed"
    | "system_admin_group_viewed";
  targetKind: "user" | "group";
  targetId?: string;
  queryType?: "user_display_name" | "user_email" | "user_id" | "group_name" | "group_id";
  queryHash?: string;
  resultCount?: number;
};

const searchUsersData = makeFunctionReference<"query", UserSearchArgs, SystemAdminUserSearchResult>(
  "systemAdmin/queries:searchUsersData",
);
const searchGroupsData = makeFunctionReference<
  "query",
  GroupSearchArgs,
  SystemAdminGroupSearchResult
>("systemAdmin/queries:searchGroupsData");
const getUserDetailData = makeFunctionReference<
  "query",
  { userId: import("../_generated/dataModel").Id<"users"> },
  SystemAdminUserDetail | null
>("systemAdmin/queries:getUserDetailData");
const getGroupDetailData = makeFunctionReference<
  "query",
  { groupId: import("../_generated/dataModel").Id<"groups"> },
  SystemAdminGroupDetail | null
>("systemAdmin/queries:getGroupDetailData");
const recordAuditLog = makeFunctionReference<"mutation", AuditArgs, null>(
  "systemAdmin/audit:recordSystemAdminAuditLog",
);

async function hashSearchQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toUserAuditQueryType(queryType: UserSearchArgs["queryType"]): AuditArgs["queryType"] {
  if (queryType === "displayName") return "user_display_name";
  if (queryType === "email") return "user_email";
  return "user_id";
}

function toGroupAuditQueryType(queryType: GroupSearchArgs["queryType"]): AuditArgs["queryType"] {
  return queryType === "name" ? "group_name" : "group_id";
}

export const searchUsers = action({
  args: {
    queryType: userSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: systemAdminUserSearchResultValidator,
  handler: async (ctx, args) => {
    const result: SystemAdminUserSearchResult = await ctx.runQuery(searchUsersData, args);
    await ctx.runMutation(recordAuditLog, {
      action: "system_admin_user_searched",
      targetKind: "user",
      queryType: toUserAuditQueryType(args.queryType),
      queryHash: await hashSearchQuery(args.query),
      resultCount: result.page.length,
    });
    return result;
  },
});

export const searchGroups = action({
  args: {
    queryType: groupSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: systemAdminGroupSearchResultValidator,
  handler: async (ctx, args) => {
    const result: SystemAdminGroupSearchResult = await ctx.runQuery(searchGroupsData, args);
    await ctx.runMutation(recordAuditLog, {
      action: "system_admin_group_searched",
      targetKind: "group",
      queryType: toGroupAuditQueryType(args.queryType),
      queryHash: await hashSearchQuery(args.query),
      resultCount: result.page.length,
    });
    return result;
  },
});

export const getUserDetail = action({
  args: { userId: v.id("users") },
  returns: v.union(systemAdminUserDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const result: SystemAdminUserDetail | null = await ctx.runQuery(getUserDetailData, args);
    await ctx.runMutation(recordAuditLog, {
      action: "system_admin_user_viewed",
      targetKind: "user",
      targetId: args.userId,
      resultCount: result === null ? 0 : 1,
    });
    return result;
  },
});

export const getGroupDetail = action({
  args: { groupId: v.id("groups") },
  returns: v.union(systemAdminGroupDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const result: SystemAdminGroupDetail | null = await ctx.runQuery(getGroupDetailData, args);
    await ctx.runMutation(recordAuditLog, {
      action: "system_admin_group_viewed",
      targetKind: "group",
      targetId: args.groupId,
      resultCount: result === null ? 0 : 1,
    });
    return result;
  },
});
