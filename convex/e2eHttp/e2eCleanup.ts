import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { invalidJsonResponse, requireE2eSecret } from "./e2eAuth";

// ---------------------------------------------------------------------------
// POST /e2e/cleanup
// ---------------------------------------------------------------------------
//
// E2E テスト専用のデータクリーンアップエンドポイント。
// テストグループのレシート削除と、必要に応じた週次セッション状態リセットを行い、
// Dev DB のゴミや状態依存を防ぐ。
//
// セキュリティ:
//   - X-E2E-Cleanup-Secret ヘッダーで認証する。
//     値は環境変数 E2E_CLEANUP_SECRET と照合する。
//   - 環境変数 E2E_CLEANUP_SECRET が未設定の場合は 503 を返す（本番環境ガード）。
//
// リクエストボディ:
//   {
//     "userId": "<Clerk の tokenIdentifier>",   // clearMonthlyIncome 用（users テーブルは userId ベースのまま）
//     "email": "<Clerk の email>",              // userId の代替解決用
//     "groupId": "<groups テーブルの ID>",        // グループデータのクリーンアップ用
//     "clearGroupMemberships": true,
//     "resetWeekSession": true,
//     "weekStartDate": "YYYY-MM-DD",
//     "deleteE2eCategories": true,
//     "clearAiExpenseQueue": true,
//     "clearLineLink": true
//   }
//
// レスポンス:
//   200: { "deletedCount": <削除件数> }
//   401: 認証失敗
//   503: E2E_CLEANUP_SECRET 未設定（本番環境での誤操作防止）
//
export const e2eCleanupHandler = httpAction(async (ctx, req) => {
  const authError = requireE2eSecret(req, "E2E cleanup is not enabled in this environment.");
  if (authError) {
    return authError;
  }

  let body: {
    userId?: string;
    email?: string;
    groupId?: string;
    resetWeekSession?: boolean;
    weekStartDate?: string;
    deleteE2eCategories?: boolean;
    clearMonthlyIncome?: boolean;
    clearAiExpenseQueue?: boolean;
    clearE2eExpenseEntries?: boolean;
    clearGroupMemberships?: boolean;
    clearGroupInvitations?: boolean;
    clearLineLink?: boolean;
    setGroupMemberRole?: "owner" | "member";
    seedGroupMember?: { displayName: string; email: string };
  };
  try {
    body = (await req.json()) as {
      userId?: string;
      email?: string;
      groupId?: string;
      resetWeekSession?: boolean;
      weekStartDate?: string;
      deleteE2eCategories?: boolean;
      clearMonthlyIncome?: boolean;
      clearAiExpenseQueue?: boolean;
      clearE2eExpenseEntries?: boolean;
      clearGroupMemberships?: boolean;
      clearGroupInvitations?: boolean;
      clearLineLink?: boolean;
      setGroupMemberRole?: "owner" | "member";
      seedGroupMember?: { displayName: string; email: string };
    };
  } catch {
    return invalidJsonResponse();
  }
  const userIdByEmail = body.email
    ? await ctx.runQuery(internal.users.internal.getUserIdByEmail, { email: body.email })
    : null;
  const resolvedUserId = userIdByEmail ?? body.userId ?? null;

  let resolvedGroupId: Id<"groups"> | null = null;
  if (body.groupId) {
    resolvedGroupId = await ctx.runQuery(internal.groups.e2e.normalizeGroupId, {
      groupId: body.groupId,
    });
  } else if (resolvedUserId) {
    resolvedGroupId = await ctx.runQuery(internal.groups.e2e.getGroupIdByUserId, {
      userId: resolvedUserId,
    });
  }

  const requestedUserScopedCleanup = Boolean(
    body.clearMonthlyIncome ||
    body.clearGroupMemberships ||
    body.clearLineLink ||
    body.setGroupMemberRole ||
    body.seedGroupMember,
  );

  if (requestedUserScopedCleanup && !resolvedUserId) {
    return new Response(JSON.stringify({ error: "userId or email is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (body.resetWeekSession && !resolvedGroupId) {
    return new Response(JSON.stringify({ error: "groupId is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let receipts: { deletedCount: number } | null = null;
  if (resolvedGroupId) {
    receipts = await ctx.runMutation(internal.receipts.crud.deleteReceiptsByUser, {
      groupId: resolvedGroupId,
    });
  }

  let aiExpenseQueue: {
    deletedDraftCount: number;
    deletedItemCount: number;
    deletedBatchCount: number;
    deletedJobCount: number;
  } | null = null;
  if (resolvedGroupId && body.clearAiExpenseQueue) {
    let deletedDraftCount = 0;
    let deletedItemCount = 0;
    let deletedBatchCount = 0;
    let deletedJobCount = 0;

    while (true) {
      const draftResult: {
        deletedDraftCount: number;
        deletedItemCount: number;
        hasMore: boolean;
      } = await ctx.runMutation(internal.aiExpenseDrafts.internal.deleteDraftsByUserBatch, {
        groupId: resolvedGroupId,
      });
      deletedDraftCount += draftResult.deletedDraftCount;
      deletedItemCount += draftResult.deletedItemCount;
      if (!draftResult.hasMore) {
        break;
      }
    }

    while (true) {
      const jobResult: { deletedBatchCount: number; deletedJobCount: number; hasMore: boolean } =
        await ctx.runMutation(
          internal.receiptAnalysisJobs.internal.deleteReceiptAnalysisDataByUserBatch,
          {
            groupId: resolvedGroupId,
          },
        );
      deletedBatchCount += jobResult.deletedBatchCount;
      deletedJobCount += jobResult.deletedJobCount;
      if (!jobResult.hasMore) {
        break;
      }
    }

    aiExpenseQueue = {
      deletedDraftCount,
      deletedItemCount,
      deletedBatchCount,
      deletedJobCount,
    };
  }

  let weekSession: { reset: boolean } | null = null;
  if (resolvedGroupId && body.resetWeekSession) {
    if (!body.weekStartDate) {
      return new Response(
        JSON.stringify({ error: "weekStartDate is required when resetWeekSession is true." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    weekSession = await ctx.runMutation(internal.weekSessions.internal.resetWeekSessionForUser, {
      groupId: resolvedGroupId,
      weekStartDate: body.weekStartDate,
    });
  }

  let categories: { deletedCount: number } | null = null;
  if (resolvedGroupId && body.deleteE2eCategories) {
    categories = await ctx.runMutation(internal.categories.internal.deleteE2eCategoriesByUser, {
      groupId: resolvedGroupId,
    });
  }

  let monthlyIncome: { cleared: boolean } | null = null;
  if (body.clearMonthlyIncome && resolvedUserId) {
    monthlyIncome = await ctx.runMutation(internal.users.internal.clearUserMonthlyIncome, {
      userId: resolvedUserId,
    });
  }

  let lineLink: { deletedCount: number } | null = null;
  if (body.clearLineLink && resolvedUserId) {
    let deletedCount = 0;
    let hasMore = true;
    while (hasMore) {
      const result = await ctx.runMutation(internal.lineLink.internal.clearE2eDataForUser, {
        userId: resolvedUserId,
      });
      deletedCount += result.deletedCount;
      hasMore = result.hasMore;
    }
    lineLink = { deletedCount };
  }

  let expenseEntries: { deletedCount: number } | null = null;
  if (resolvedGroupId && body.clearE2eExpenseEntries) {
    expenseEntries = await ctx.runMutation(
      internal.expenseEntries.internal.deleteE2eExpenseEntriesByUser,
      {
        groupId: resolvedGroupId,
      },
    );
  }

  let groupMemberships: { deletedCount: number } | null = null;
  if (body.clearGroupMemberships) {
    if (resolvedUserId) {
      groupMemberships = await ctx.runMutation(internal.groups.e2e.deleteGroupMembershipsByUser, {
        userId: resolvedUserId,
      });
    }
  }

  let groupMemberRole: { updated: boolean } | null = null;
  if (body.setGroupMemberRole && resolvedUserId) {
    groupMemberRole = await ctx.runMutation(internal.groups.e2e.setGroupMemberRoleForE2e, {
      userId: resolvedUserId,
      role: body.setGroupMemberRole,
    });
  }

  let groupInvitations: { deletedCount: number } | null = null;
  if (resolvedGroupId && body.clearGroupInvitations) {
    groupInvitations = await ctx.runMutation(internal.groups.e2e.clearGroupInvitationsForE2e, {
      groupId: resolvedGroupId,
    });
  }

  let seededGroupMember: { memberUserId: string } | null = null;
  if (body.seedGroupMember) {
    if (!resolvedGroupId) {
      return new Response(JSON.stringify({ error: "groupId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const displayName = body.seedGroupMember.displayName?.trim();
    const memberEmail = body.seedGroupMember.email?.trim().toLowerCase();
    if (!displayName || !memberEmail) {
      return new Response(
        JSON.stringify({ error: "seedGroupMember.displayName and email are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    seededGroupMember = await ctx.runMutation(internal.groups.e2e.seedGroupMemberForE2e, {
      groupId: resolvedGroupId,
      displayName,
      email: memberEmail,
    });
  }

  return new Response(
    JSON.stringify({
      receipts,
      aiExpenseQueue,
      weekSession,
      categories,
      monthlyIncome,
      lineLink,
      expenseEntries,
      groupMemberships,
      groupMemberRole,
      groupInvitations,
      seededGroupMember,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
