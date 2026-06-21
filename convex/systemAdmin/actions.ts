import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
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
type AuditQueryType = "user_display_name" | "user_email" | "user_id" | "group_name" | "group_id";

async function hashSearchQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toUserAuditQueryType(queryType: UserSearchArgs["queryType"]): AuditQueryType {
  if (queryType === "displayName") return "user_display_name";
  if (queryType === "email") return "user_email";
  return "user_id";
}

function toGroupAuditQueryType(queryType: GroupSearchArgs["queryType"]): AuditQueryType {
  return queryType === "name" ? "group_name" : "group_id";
}

export const searchUsers = action({
  args: {
    queryType: userSearchTypeValidator,
    query: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: systemAdminUserSearchResultValidator,
  handler: async (ctx, args): Promise<SystemAdminUserSearchResult> => {
    const result: SystemAdminUserSearchResult = await ctx.runQuery(
      internal.systemAdmin.queries.searchUsersData,
      args,
    );
    await ctx.runMutation(internal.systemAdmin.audit.recordSystemAdminAuditLog, {
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
  handler: async (ctx, args): Promise<SystemAdminGroupSearchResult> => {
    const result: SystemAdminGroupSearchResult = await ctx.runQuery(
      internal.systemAdmin.queries.searchGroupsData,
      args,
    );
    await ctx.runMutation(internal.systemAdmin.audit.recordSystemAdminAuditLog, {
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
  handler: async (ctx, args): Promise<SystemAdminUserDetail | null> => {
    const result: SystemAdminUserDetail | null = await ctx.runQuery(
      internal.systemAdmin.queries.getUserDetailData,
      args,
    );
    await ctx.runMutation(internal.systemAdmin.audit.recordSystemAdminAuditLog, {
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
  handler: async (ctx, args): Promise<SystemAdminGroupDetail | null> => {
    const result: SystemAdminGroupDetail | null = await ctx.runQuery(
      internal.systemAdmin.queries.getGroupDetailData,
      args,
    );
    await ctx.runMutation(internal.systemAdmin.audit.recordSystemAdminAuditLog, {
      action: "system_admin_group_viewed",
      targetKind: "group",
      targetId: args.groupId,
      resultCount: result === null ? 0 : 1,
    });
    return result;
  },
});
