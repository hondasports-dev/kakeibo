import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// ---------------------------------------------------------------------------
// POST /e2e/cleanup
// ---------------------------------------------------------------------------
//
// E2E テスト専用のデータクリーンアップエンドポイント。
// テストユーザーのレシートを全件削除して Dev DB のゴミを防ぐ。
//
// セキュリティ:
//   - X-E2E-Cleanup-Secret ヘッダーで認証する。
//     値は環境変数 E2E_CLEANUP_SECRET と照合する。
//   - 環境変数 E2E_CLEANUP_SECRET が未設定の場合は 503 を返す（本番環境ガード）。
//
// リクエストボディ:
//   { "userId": "<Clerk の tokenIdentifier>" }
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
      return new Response(
        JSON.stringify({ error: "Unauthorized." }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = await req.json() as { userId?: string };
    if (!body.userId) {
      return new Response(
        JSON.stringify({ error: "userId is required." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await ctx.runMutation(internal.receipts.deleteReceiptsByUser, {
      userId: body.userId,
    });

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
});

export default http;
