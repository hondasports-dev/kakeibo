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
      };
    } catch {
      return invalidJsonResponse();
    }
    const shouldOperateOnGroup = Boolean(
      body.groupId ||
      body.resetWeekSession ||
      body.deleteE2eCategories ||
      body.clearAiExpenseQueue ||
      body.clearE2eExpenseEntries,
    );

    if (!shouldOperateOnGroup && !body.clearGroupMemberships) {
      return new Response(JSON.stringify({ error: "groupId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let receipts: { deletedCount: number } | null = null;
    if (body.groupId) {
      receipts = await ctx.runMutation(internal.receipts.deleteReceiptsByUser, {
        groupId: body.groupId as never,
      });
    }

    let aiExpenseQueue: {
      deletedDraftCount: number;
      deletedItemCount: number;
      deletedBatchCount: number;
      deletedJobCount: number;
    } | null = null;
    if (body.groupId && body.clearAiExpenseQueue) {
      let deletedDraftCount = 0;
      let deletedItemCount = 0;
      let deletedBatchCount = 0;
      let deletedJobCount = 0;

      while (true) {
        const draftResult: {
          deletedDraftCount: number;
          deletedItemCount: number;
          hasMore: boolean;
        } = await ctx.runMutation(internal.aiExpenseDrafts.deleteDraftsByUserBatch, {
          groupId: body.groupId as never,
        });
        deletedDraftCount += draftResult.deletedDraftCount;
        deletedItemCount += draftResult.deletedItemCount;
        if (!draftResult.hasMore) {
          break;
        }
      }

      while (true) {
        const jobResult: { deletedBatchCount: number; deletedJobCount: number; hasMore: boolean } =
          await ctx.runMutation(internal.receiptAnalysisJobs.deleteReceiptAnalysisDataByUserBatch, {
            groupId: body.groupId as never,
          });
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
    if (body.groupId && body.resetWeekSession) {
      if (!body.weekStartDate) {
        return new Response(
          JSON.stringify({ error: "weekStartDate is required when resetWeekSession is true." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      weekSession = await ctx.runMutation(internal.weekSessions.resetWeekSessionForUser, {
        groupId: body.groupId as never,
        weekStartDate: body.weekStartDate,
      });
    }

    let categories: { deletedCount: number } | null = null;
    if (body.groupId && body.deleteE2eCategories) {
      categories = await ctx.runMutation(internal.categories.deleteE2eCategoriesByUser, {
        groupId: body.groupId as never,
      });
    }

    let monthlyIncome: { cleared: boolean } | null = null;
    if (body.clearMonthlyIncome && body.userId) {
      monthlyIncome = await ctx.runMutation(internal.users.clearUserMonthlyIncome, {
        userId: body.userId,
      });
    }

    let expenseEntries: { deletedCount: number } | null = null;
    if (body.groupId && body.clearE2eExpenseEntries) {
      expenseEntries = await ctx.runMutation(
        internal.expenseEntries.deleteE2eExpenseEntriesByUser,
        {
          groupId: body.groupId as never,
        },
      );
    }

    let groupMemberships: { deletedCount: number } | null = null;
    if (body.clearGroupMemberships) {
      const resolvedUserId =
        body.userId ??
        (body.email
          ? await ctx.runQuery(internal.users.getUserIdByEmail, { email: body.email })
          : null);

      if (resolvedUserId) {
        groupMemberships = await ctx.runMutation(internal.groups.deleteGroupMembershipsByUser, {
          userId: resolvedUserId,
        });
      }
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

    let body: { groupId?: string };
    try {
      body = (await req.json()) as { groupId?: string };
    } catch {
      return invalidJsonResponse();
    }
    if (!body.groupId) {
      return new Response(JSON.stringify({ error: "groupId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const categoryId = await ctx.runMutation(internal.categories.ensureE2eCategoryByUser, {
      groupId: body.groupId as never,
      name: "E2Eカテゴリ-Issue179",
      color: "#2563EB",
    });
    const draftId = await ctx.runMutation(internal.aiExpenseDrafts.createE2eReadyDraftForUser, {
      groupId: body.groupId as never,
      categoryId,
    });

    return new Response(JSON.stringify({ draftId, categoryId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
