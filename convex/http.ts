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
      };
    } catch {
      return invalidJsonResponse();
    }
    const userIdByEmail = body.email
      ? await ctx.runQuery(internal.users.getUserIdByEmail, { email: body.email })
      : null;
    const resolvedUserId = userIdByEmail ?? body.userId ?? null;
    const resolvedGroupId =
      body.groupId ??
      (resolvedUserId
        ? await ctx.runQuery(internal.groups.getGroupIdByUserId, { userId: resolvedUserId })
        : null);

    const requestedUserScopedCleanup = Boolean(
      body.clearMonthlyIncome || body.clearGroupMemberships || body.setGroupMemberRole,
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
      receipts = await ctx.runMutation(internal.receipts.deleteReceiptsByUser, {
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
        } = await ctx.runMutation(internal.aiExpenseDrafts.deleteDraftsByUserBatch, {
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
          await ctx.runMutation(internal.receiptAnalysisJobs.deleteReceiptAnalysisDataByUserBatch, {
            groupId: resolvedGroupId as never,
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
    if (resolvedGroupId && body.resetWeekSession) {
      if (!body.weekStartDate) {
        return new Response(
          JSON.stringify({ error: "weekStartDate is required when resetWeekSession is true." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      weekSession = await ctx.runMutation(internal.weekSessions.resetWeekSessionForUser, {
        groupId: resolvedGroupId as never,
        weekStartDate: body.weekStartDate,
      });
    }

    let categories: { deletedCount: number } | null = null;
    if (resolvedGroupId && body.deleteE2eCategories) {
      categories = await ctx.runMutation(internal.categories.deleteE2eCategoriesByUser, {
        groupId: resolvedGroupId as never,
      });
    }

    let monthlyIncome: { cleared: boolean } | null = null;
    if (body.clearMonthlyIncome && resolvedUserId) {
      monthlyIncome = await ctx.runMutation(internal.users.clearUserMonthlyIncome, {
        userId: resolvedUserId,
      });
    }

    let expenseEntries: { deletedCount: number } | null = null;
    if (resolvedGroupId && body.clearE2eExpenseEntries) {
      expenseEntries = await ctx.runMutation(
        internal.expenseEntries.deleteE2eExpenseEntriesByUser,
        {
          groupId: resolvedGroupId as never,
        },
      );
    }

    let groupMemberships: { deletedCount: number } | null = null;
    if (body.clearGroupMemberships) {
      if (resolvedUserId) {
        groupMemberships = await ctx.runMutation(internal.groups.deleteGroupMembershipsByUser, {
          userId: resolvedUserId,
        });
      }
    }

    let groupMemberRole: { updated: boolean } | null = null;
    if (body.setGroupMemberRole && resolvedUserId) {
      groupMemberRole = await ctx.runMutation(internal.groups.setGroupMemberRoleForE2e, {
        userId: resolvedUserId,
        role: body.setGroupMemberRole,
      });
    }

    let groupInvitations: { deletedCount: number } | null = null;
    if (resolvedGroupId && body.clearGroupInvitations) {
      groupInvitations = await ctx.runMutation(internal.groups.clearGroupInvitationsForE2e, {
        groupId: resolvedGroupId as never,
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
      ? await ctx.runQuery(internal.users.getUserIdByEmail, { email: body.email })
      : null;
    const resolvedUserId = userIdByEmail ?? body.userId ?? null;
    const resolvedGroupId =
      body.groupId ??
      (resolvedUserId
        ? await ctx.runQuery(internal.groups.getGroupIdByUserId, { userId: resolvedUserId })
        : null);

    if (!resolvedGroupId) {
      return new Response(JSON.stringify({ error: "groupId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const categoryId = await ctx.runMutation(internal.categories.ensureE2eCategoryByUser, {
      groupId: resolvedGroupId as never,
      name: "E2Eカテゴリ-Issue179",
      color: "#AAB7C4",
    });
    const draftId = await ctx.runMutation(internal.aiExpenseDrafts.createE2eReadyDraftForUser, {
      groupId: resolvedGroupId as never,
      categoryId,
    });

    return new Response(JSON.stringify({ draftId, categoryId }), {
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
      ? await ctx.runQuery(internal.users.getUserIdByEmail, { email: body.email })
      : null;
    const resolvedUserId = userIdByEmail ?? body.userId ?? null;
    const resolvedGroupId =
      body.groupId ??
      (resolvedUserId
        ? await ctx.runQuery(internal.groups.getGroupIdByUserId, { userId: resolvedUserId })
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

    const invitationId = await ctx.runMutation(internal.groups.seedPendingGroupInvitationForE2e, {
      groupId: resolvedGroupId as never,
      email: invitationEmail,
      invitedByUserId: resolvedUserId,
    });

    return new Response(JSON.stringify({ invitationId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/e2e/seed-group-member",
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

    let body: {
      userId?: string;
      email?: string;
      groupId?: string;
      memberDisplayName?: string;
      memberEmail?: string;
    };
    try {
      body = (await req.json()) as {
        userId?: string;
        email?: string;
        groupId?: string;
        memberDisplayName?: string;
        memberEmail?: string;
      };
    } catch {
      return invalidJsonResponse();
    }

    const userIdByEmail = body.email
      ? await ctx.runQuery(internal.users.getUserIdByEmail, { email: body.email })
      : null;
    const resolvedUserId = userIdByEmail ?? body.userId ?? null;
    const resolvedGroupId =
      body.groupId ??
      (resolvedUserId
        ? await ctx.runQuery(internal.groups.getGroupIdByUserId, { userId: resolvedUserId })
        : null);

    if (!resolvedGroupId) {
      return new Response(JSON.stringify({ error: "groupId is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const memberDisplayName = body.memberDisplayName?.trim();
    const memberEmail = body.memberEmail?.trim().toLowerCase();
    if (!memberDisplayName || !memberEmail) {
      return new Response(
        JSON.stringify({ error: "memberDisplayName and memberEmail are required." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await ctx.runMutation(internal.groups.seedGroupMemberForE2e, {
      groupId: resolvedGroupId as never,
      displayName: memberDisplayName,
      email: memberEmail,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
