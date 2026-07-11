"use node";

import { createClerkClient } from "@clerk/backend";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function safeError(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
  if (status === 404) return { kind: "already_deleted" as const };
  if (status === 429 || status >= 500 || status === 0)
    return {
      kind: "retryable" as const,
      code: "identity_deletion_failed",
      message: "アカウント削除を完了できませんでした。時間をおいて再試行してください。",
    };
  return {
    kind: "failed" as const,
    code: "identity_deletion_failed",
    message: "アカウント削除を完了できませんでした。もう一度お試しください。",
  };
}

export const processAccountDeletion = internalAction({
  args: { requestId: v.id("accountDeletionRequests") },
  handler: async (ctx, args) => {
    const request = await ctx.runQuery(internal.accountDeletion.getRequest, args);
    if (!request || request.status === "completed") return;
    if (request.status === "identity_deleted" || request.status === "finalization_retry_wait") {
      try {
        await ctx.runMutation(internal.accountDeletion.finalizeAccountDeletion, args);
      } catch {
        await ctx.runMutation(internal.accountDeletion.scheduleRetry, {
          ...args,
          code: "finalization_failed",
          message: "退会処理の完了に失敗しました。",
          finalization: true,
        });
      }
      return;
    }
    await ctx.runMutation(internal.accountDeletion.markDeletingIdentity, args);
    try {
      if (process.env.APP_ENV === "production") {
        const secretKey = process.env.CLERK_SECRET_KEY;
        if (!secretKey) throw new Error("Clerk configuration unavailable");
        await createClerkClient({ secretKey }).users.deleteUser(request.clerkUserId);
      }
    } catch (error) {
      const result = safeError(error);
      if (result.kind === "failed" || result.kind === "retryable") {
        await ctx.runMutation(internal.accountDeletion.scheduleRetry, {
          ...args,
          code: result.code,
          message: result.message,
          finalization: false,
        });
        return;
      }
    }
    await ctx.runMutation(internal.accountDeletion.markIdentityDeleted, args);
    try {
      await ctx.runMutation(internal.accountDeletion.finalizeAccountDeletion, args);
    } catch {
      await ctx.runMutation(internal.accountDeletion.scheduleRetry, {
        ...args,
        code: "finalization_failed",
        message: "退会処理の完了に失敗しました。",
        finalization: true,
      });
    }
  },
});
