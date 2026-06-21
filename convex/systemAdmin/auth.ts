import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type SystemAdminAuthContext = Pick<QueryCtx | MutationCtx, "auth" | "db">;

export async function requireSystemAdmin(ctx: SystemAdminAuthContext) {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError("システム管理者権限が必要です");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token_identifier", (q) => q.eq("userId", identity.tokenIdentifier))
    .unique();
  if (user === null) {
    throw new ConvexError("システム管理者権限が必要です");
  }

  const systemAdmin = await ctx.db
    .query("systemAdmins")
    .withIndex("by_user_id", (q) => q.eq("userId", user._id))
    .unique();
  if (systemAdmin === null || systemAdmin.status !== "active") {
    throw new ConvexError("システム管理者権限が必要です");
  }

  return { user, systemAdmin };
}
