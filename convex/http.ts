import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function invalidJsonResponse() {
  return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

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
//     "clearAiExpenseQueue": true
//   }
//
// レスポンス:
//   200: { "deletedCount": <削除件数> }
//   401: 認証失敗
//   503: E2E_CLEANUP_SECRET 未設定（本番環境での誤操作防止）
//
http.route({
  path: "/e2e/cleanup",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // 本番環境ガード: E2E_CLEANUP_SECRET が未設定なら無効化
    const secret = process.env.E2E_CLEANUP_SECRET;
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "E2E cleanup is not enabled in this environment." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // 認証チェック
    const clientSecret = req.headers.get("X-E2E-Cleanup-Secret");
    if (clientSecret !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
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
    const resolvedGroupId =
      body.groupId ??
      (resolvedUserId
        ? await ctx.runQuery(internal.groups.e2e.getGroupIdByUserId, { userId: resolvedUserId })
        : null);

    const requestedUserScopedCleanup = Boolean(
      body.clearMonthlyIncome ||
      body.clearGroupMemberships ||
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
        groupId: resolvedGroupId as never,
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
          groupId: resolvedGroupId as never,
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
              groupId: resolvedGroupId as never,
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
        groupId: resolvedGroupId as never,
        weekStartDate: body.weekStartDate,
      });
    }

    let categories: { deletedCount: number } | null = null;
    if (resolvedGroupId && body.deleteE2eCategories) {
      categories = await ctx.runMutation(internal.categories.internal.deleteE2eCategoriesByUser, {
        groupId: resolvedGroupId as never,
      });
    }

    let monthlyIncome: { cleared: boolean } | null = null;
    if (body.clearMonthlyIncome && resolvedUserId) {
      monthlyIncome = await ctx.runMutation(internal.users.internal.clearUserMonthlyIncome, {
        userId: resolvedUserId,
      });
    }

    let expenseEntries: { deletedCount: number } | null = null;
    if (resolvedGroupId && body.clearE2eExpenseEntries) {
      expenseEntries = await ctx.runMutation(
        internal.expenseEntries.internal.deleteE2eExpenseEntriesByUser,
        {
          groupId: resolvedGroupId as never,
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
        groupId: resolvedGroupId as never,
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
        groupId: resolvedGroupId as never,
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
  }),
});

http.route({
  path: "/e2e/seed-ai-expense-draft",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.E2E_CLEANUP_SECRET;
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "E2E seeding is not enabled in this environment." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const clientSecret = req.headers.get("X-E2E-Cleanup-Secret");
    if (clientSecret !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { userId?: string; email?: string; groupId?: string };
    try {
      body = (await req.json()) as { userId?: string; email?: string; groupId?: string };
    } catch {
      return invalidJsonResponse();
    }
    const userIdByEmail = body.email
      ? await ctx.runQuery(internal.users.internal.getUserIdByEmail, { email: body.email })
      : null;
    const resolvedUserId = userIdByEmail ?? body.userId ?? null;
    const resolvedGroupId =
      body.groupId ??
      (resolvedUserId
        ? await ctx.runQuery(internal.groups.e2e.getGroupIdByUserId, { userId: resolvedUserId })
        : null);

    if (!resolvedGroupId) {
      return new Response(JSON.stringify({ error: "groupId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const categoryId = await ctx.runMutation(internal.categories.internal.ensureE2eCategoryByUser, {
      groupId: resolvedGroupId as never,
      name: "E2Eカテゴリ-食費-Issue322",
      color: "#AAB7C4",
    });
    const secondaryCategoryId = await ctx.runMutation(
      internal.categories.internal.ensureE2eCategoryByUser,
      {
        groupId: resolvedGroupId as never,
        name: "E2Eカテゴリ-日用品-Issue322",
        color: "#A6B28B",
      },
    );
    const draftId = await ctx.runMutation(
      internal.aiExpenseDrafts.internal.createE2eReadyDraftForUser,
      {
        groupId: resolvedGroupId as never,
        categoryId,
        secondaryCategoryId,
      },
    );

    return new Response(JSON.stringify({ draftId, categoryId, secondaryCategoryId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/e2e/seed-pending-group-invitation",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.E2E_CLEANUP_SECRET;
    if (!secret) {
      return new Response(
        JSON.stringify({ error: "E2E seeding is not enabled in this environment." }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    const clientSecret = req.headers.get("X-E2E-Cleanup-Secret");
    if (clientSecret !== secret) {
      return new Response(JSON.stringify({ error: "Unauthorized." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let body: { userId?: string; email?: string; groupId?: string; invitationEmail?: string };
    try {
      body = (await req.json()) as {
        userId?: string;
        email?: string;
        groupId?: string;
        invitationEmail?: string;
      };
    } catch {
      return invalidJsonResponse();
    }

    const userIdByEmail = body.email
      ? await ctx.runQuery(internal.users.internal.getUserIdByEmail, { email: body.email })
      : null;
    const resolvedUserId = userIdByEmail ?? body.userId ?? null;
    const resolvedGroupId =
      body.groupId ??
      (resolvedUserId
        ? await ctx.runQuery(internal.groups.e2e.getGroupIdByUserId, { userId: resolvedUserId })
        : null);

    if (!resolvedGroupId || !resolvedUserId) {
      return new Response(JSON.stringify({ error: "groupId and userId are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const invitationEmail = body.invitationEmail?.trim().toLowerCase();
    if (!invitationEmail) {
      return new Response(JSON.stringify({ error: "invitationEmail is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const invitationId = await ctx.runMutation(
      internal.groups.e2e.seedPendingGroupInvitationForE2e,
      {
        groupId: resolvedGroupId as never,
        email: invitationEmail,
        invitedByUserId: resolvedUserId,
      },
    );

    return new Response(JSON.stringify({ invitationId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
