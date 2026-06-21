import { v } from "convex/values";

export const systemAdminStatusValidator = v.union(v.literal("active"), v.literal("revoked"));

export const systemAdminAuditActionValidator = v.union(
  v.literal("system_admin_bootstrapped"),
  v.literal("system_admin_granted"),
  v.literal("system_admin_revoked"),
  v.literal("system_admin_recovered"),
  v.literal("system_admin_user_searched"),
  v.literal("system_admin_group_searched"),
  v.literal("system_admin_user_viewed"),
  v.literal("system_admin_group_viewed"),
);

export const systemAdminAuditActorTypeValidator = v.union(
  v.literal("system"),
  v.literal("system_admin"),
);

export const systemAdminAuditTargetKindValidator = v.union(
  v.literal("system_admin"),
  v.literal("user"),
  v.literal("group"),
);

export const systemAdminSearchQueryTypeValidator = v.union(
  v.literal("user_display_name"),
  v.literal("user_email"),
  v.literal("user_id"),
  v.literal("group_name"),
  v.literal("group_id"),
);
