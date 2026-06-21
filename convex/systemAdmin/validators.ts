import { paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";

export const systemAdminEnvironmentValidator = v.union(
  v.literal("development"),
  v.literal("preview"),
  v.literal("production"),
);

export const userSearchTypeValidator = v.union(
  v.literal("displayName"),
  v.literal("email"),
  v.literal("userId"),
);

export const groupSearchTypeValidator = v.union(v.literal("name"), v.literal("groupId"));

export const systemAdminUserListItemValidator = v.object({
  id: v.id("users"),
  clerkUserId: v.string(),
  displayName: v.string(),
  email: v.union(v.string(), v.null()),
  activeGroupId: v.union(v.id("groups"), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const systemAdminGroupListItemValidator = v.object({
  id: v.id("groups"),
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("deleted"), v.literal("archived")),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const systemAdminUserSearchResultValidator = v.object({
  environment: systemAdminEnvironmentValidator,
  ...paginationResultValidator(systemAdminUserListItemValidator).fields,
});

export const systemAdminGroupSearchResultValidator = v.object({
  environment: systemAdminEnvironmentValidator,
  ...paginationResultValidator(systemAdminGroupListItemValidator).fields,
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

export const systemAdminUserDetailValidator = v.object({
  ...systemAdminUserListItemValidator.fields,
  environment: systemAdminEnvironmentValidator,
  memberships: v.array(userMembershipValidator),
  invitations: v.array(userInvitationValidator),
  membershipsTruncated: v.boolean(),
  invitationsTruncated: v.boolean(),
});

const groupMemberValidator = v.object({
  userId: v.union(v.id("users"), v.null()),
  clerkUserId: v.string(),
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

export const systemAdminGroupDetailValidator = v.object({
  ...systemAdminGroupListItemValidator.fields,
  environment: systemAdminEnvironmentValidator,
  members: v.array(groupMemberValidator),
  invitations: v.array(groupInvitationValidator),
  membersTruncated: v.boolean(),
  invitationsTruncated: v.boolean(),
});

export type SystemAdminUserSearchResult = Infer<typeof systemAdminUserSearchResultValidator>;
export type SystemAdminGroupSearchResult = Infer<typeof systemAdminGroupSearchResultValidator>;
export type SystemAdminUserDetail = Infer<typeof systemAdminUserDetailValidator>;
export type SystemAdminGroupDetail = Infer<typeof systemAdminGroupDetailValidator>;

export function getSystemAdminEnvironment(): "development" | "preview" | "production" {
  const environment = process.env.APP_ENV;
  if (environment === "development" || environment === "preview" || environment === "production") {
    return environment;
  }
  throw new ConvexError("APP_ENVが正しく設定されていません");
}
