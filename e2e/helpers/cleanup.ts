/**
 * E2E テストデータクリーンアップヘルパー
 *
 * テスト中に Convex Dev DB に作成したレシートを afterEach で削除し、
 * 共有 Dev DB にゴミが溜まるのを防ぐ。
 *
 * 仕組み:
 *   Convex HTTP エンドポイント（POST /e2e/cleanup）を呼び出し、
 *   テストユーザーのレシートを全件削除する。
 *
 * 必要な環境変数:
 *   VITE_CONVEX_SITE_URL  — Convex HTTP エンドポイントのベース URL
 *                           例: https://hardy-mockingbird-708.convex.site
 *   E2E_CLEANUP_SECRET    — Convex 側の E2E_CLEANUP_SECRET 環境変数と同じ値
 *   E2E_CLERK_USER_ID     — テストユーザーの Clerk tokenIdentifier
 *                           例: https://xxx.clerk.accounts.dev|user_xxxxxx
 *
 * セットアップ:
 *   1. Convex Dashboard > Settings > Environment Variables に
 *      E2E_CLEANUP_SECRET=<任意のランダム文字列> を追加する。
 *   2. .env.local（ローカル）と GitHub Secrets（CI）に同じ値を設定する。
 *   3. E2E_CLERK_USER_ID は Clerk Dashboard > Users でテストユーザーの
 *      User ID を確認し、"https://<your-domain>.clerk.accounts.dev|<user_id>" の
 *      形式で設定する（AGENTS.md の「E2E クリーンアップ設定」参照）。
 */

/**
 * テストユーザーのレシートを全件削除する。
 *
 * 環境変数が未設定の場合は警告のみ出してスキップする（ローカル開発の利便性のため）。
 * CI 環境（process.env.CI === 'true'）では未設定の場合にエラーをスローする。
 */
export async function cleanupTestReceipts(): Promise<void> {
  await callCleanupEndpoint({ userId: getCleanupUserId() });
}

/**
 * テスト中に作成した AI 支出キュー関連データを削除する。
 */
export async function cleanupAiExpenseQueue(): Promise<void> {
  await callCleanupEndpoint({
    userId: getCleanupUserId(),
    clearAiExpenseQueue: true,
  });
}

/**
 * テスト中に作成した E2E 専用 expenseEntries を削除する。
 */
export async function cleanupE2eExpenseEntries(): Promise<void> {
  await callCleanupEndpoint({
    userId: getCleanupUserId(),
    clearE2eExpenseEntries: true,
  });
}

/**
 * テスト中に作成した E2E 専用カテゴリを削除する。
 */
export async function cleanupTestCategories(): Promise<void> {
  await callCleanupEndpoint({
    userId: getCleanupUserId(),
    deleteE2eCategories: true,
  });
}

export async function cleanupAiExpenseQueueByUser(userId: string): Promise<void> {
  await callCleanupEndpoint({
    userId,
    clearAiExpenseQueue: true,
  });
}

export async function cleanupE2eExpenseEntriesByUser(userId: string): Promise<void> {
  await callCleanupEndpoint({
    userId,
    clearE2eExpenseEntries: true,
  });
}

export async function cleanupTestCategoriesByUser(userId: string): Promise<void> {
  await callCleanupEndpoint({
    userId,
    deleteE2eCategories: true,
  });
}

/**
 * 指定週のテストユーザーの週次セッションを draft に戻し、振り返りメモをクリアする。
 */
export async function resetTestWeekSession(weekStartDate: string): Promise<void> {
  await callCleanupEndpoint({
    userId: getCleanupUserId(),
    resetWeekSession: true,
    weekStartDate,
  });
}

function getCleanupUserId(): string | undefined {
  return process.env.E2E_CLERK_USER_ID?.trim().replace(/^["']+|["']+$/g, "");
}

function getCleanupUserEmail(): string | undefined {
  return process.env.E2E_CLERK_USER_EMAIL?.trim().replace(/^["']+|["']+$/g, "");
}

/**
 * テストユーザーの月収入設定をクリアする。
 */
export async function cleanupUserMonthlyIncome(): Promise<void> {
  await callCleanupEndpoint({
    userId: getCleanupUserId(),
    clearMonthlyIncome: true,
  });
}

/**
 * テストユーザーのグループ所属を削除する。
 */
export async function cleanupGroupMembershipsByUser(userId?: string): Promise<void> {
  await callCleanupEndpoint({
    userId: userId ?? getCleanupUserId(),
    email: getCleanupUserEmail(),
    clearGroupMemberships: true,
  });
}

async function callCleanupEndpoint(body: {
  userId?: string;
  email?: string;
  resetWeekSession?: boolean;
  weekStartDate?: string;
  deleteE2eCategories?: boolean;
  clearMonthlyIncome?: boolean;
  clearAiExpenseQueue?: boolean;
  clearE2eExpenseEntries?: boolean;
  clearGroupMemberships?: boolean;
}): Promise<void> {
  const siteUrl = process.env.VITE_CONVEX_SITE_URL;
  const secret = process.env.E2E_CLEANUP_SECRET;
  const userId = body.userId;

  if (!siteUrl || !secret || !userId) {
    if (process.env.CI) {
      throw new Error(
        "E2E クリーンアップに必要な環境変数が未設定です。" +
          "VITE_CONVEX_SITE_URL, E2E_CLEANUP_SECRET, E2E_CLERK_USER_ID を設定してください。",
      );
    }
    // ローカルでは警告のみ（未設定でもテストは続行できる）
    console.warn(
      "[cleanup] VITE_CONVEX_SITE_URL / E2E_CLEANUP_SECRET / E2E_CLERK_USER_ID が未設定のため" +
        "クリーンアップをスキップします。",
    );
    return;
  }

  const res = await fetch(`${siteUrl}/e2e/cleanup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-E2E-Cleanup-Secret": secret,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`E2E クリーンアップに失敗しました: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    receipts?: { deletedCount: number } | null;
    aiExpenseQueue?: {
      deletedDraftCount: number;
      deletedItemCount: number;
      deletedBatchCount: number;
      deletedJobCount: number;
    } | null;
    categories?: { deletedCount: number } | null;
    deletedCount?: number;
    weekSession?: { reset: boolean } | null;
    monthlyIncome?: { cleared: boolean } | null;
    expenseEntries?: { deletedCount: number } | null;
    groupMemberships?: { deletedCount: number } | null;
  };
  const deletedCount = data.receipts?.deletedCount ?? data.deletedCount ?? 0;
  if (deletedCount > 0) {
    console.log(`[cleanup] ${deletedCount} 件のレシートを削除しました。`);
  }
  if (data.weekSession?.reset) {
    console.log("[cleanup] 週次セッションをリセットしました。");
  }
  if (data.categories && data.categories.deletedCount > 0) {
    console.log(`[cleanup] ${data.categories.deletedCount} 件のカテゴリを削除しました。`);
  }
  if (data.aiExpenseQueue) {
    const total =
      data.aiExpenseQueue.deletedDraftCount +
      data.aiExpenseQueue.deletedItemCount +
      data.aiExpenseQueue.deletedBatchCount +
      data.aiExpenseQueue.deletedJobCount;
    if (total > 0) {
      console.log(
        `[cleanup] AI キュー関連データを削除しました。` +
          ` drafts=${data.aiExpenseQueue.deletedDraftCount}` +
          ` items=${data.aiExpenseQueue.deletedItemCount}` +
          ` batches=${data.aiExpenseQueue.deletedBatchCount}` +
          ` jobs=${data.aiExpenseQueue.deletedJobCount}`,
      );
    }
  }
  if (data.expenseEntries && data.expenseEntries.deletedCount > 0) {
    console.log(
      `[cleanup] ${data.expenseEntries.deletedCount} 件の E2E expenseEntries を削除しました。`,
    );
  }
}
