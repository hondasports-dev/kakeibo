import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  seedDefaultCategoriesHandler,
  listActiveHandler,
} from "./categories";

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

function createIdentity(overrides: Partial<UserIdentity> = {}): UserIdentity {
  return {
    tokenIdentifier: "https://issuer.example|user-001",
    subject: "user-001",
    issuer: "https://issuer.example",
    ...overrides,
  };
}

type CategoryDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

/**
 * seedDefaultCategoriesHandler が必要とする MutationCtx の最小モックを生成する。
 *
 * - withIndex のコールバックに渡す chainable な q mock を実装する
 * - q.eq("userId", ...).eq("isActive", true).eq("sortOrder", N).unique() で
 *   existingDocs から sortOrder N のドキュメントを返す
 */
function createMutationCtx(
  identity: UserIdentity | null,
  existingDocs: CategoryDoc[] = [],
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-doc-id");

  const withIndexMock = vi.fn().mockImplementation(
    (_indexName: string, builder: (q: unknown) => unknown) => {
      // builder: (q) => q.eq("userId", ...).eq("isActive", ...).eq("sortOrder", ...)
      // 各 eq の呼び出しで sortOrder の値をキャプチャし、unique() に紐付ける
      let capturedSortOrder: number | null = null;

      const q = {
        eq: vi.fn().mockImplementation((_field: string, _value: unknown) => {
          // 3番目の eq が sortOrder を指定する
          if (_field === "sortOrder") {
            capturedSortOrder = _value as number;
          }
          return q; // self-referential chain
        }),
      };

      // builder を実行して sortOrder をキャプチャさせる
      builder(q);

      // unique() は capturedSortOrder に対応するドキュメントを返す
      const doc =
        capturedSortOrder !== null
          ? (existingDocs.find(
              (d) => d.sortOrder === capturedSortOrder && d.isActive === true,
            ) ?? null)
          : null;

      return {
        unique: vi.fn().mockResolvedValue(doc),
      };
    },
  );

  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi
        .fn<() => Promise<UserIdentity | null>>()
        .mockResolvedValue(identity),
    },
    db: {
      query: queryMock,
      insert: insertMock,
    },
    // TODO: MutationCtx の完全な型を満たす型安全なモックファクトリーへの置き換えを検討する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

/**
 * listActiveHandler が必要とする QueryCtx の最小モックを生成する。
 */
function createQueryCtx(
  identity: UserIdentity | null,
  docs: CategoryDoc[] = [],
): QueryCtx {
  const collectMock = vi.fn().mockResolvedValue(docs);
  const orderMock = vi.fn().mockReturnValue({ collect: collectMock });

  const withIndexMock = vi.fn().mockImplementation(
    (_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q), // self-referential chain
      };
      builder(q);
      return { order: orderMock };
    },
  );

  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi
        .fn<() => Promise<UserIdentity | null>>()
        .mockResolvedValue(identity),
    },
    db: {
      query: queryMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as QueryCtx;
}

// ---------------------------------------------------------------------------
// seedDefaultCategories テスト
// ---------------------------------------------------------------------------

describe("seedDefaultCategories", () => {
  it("未認証時は ConvexError を throw する", async () => {
    const ctx = createMutationCtx(null);

    await expect(seedDefaultCategoriesHandler(ctx)).rejects.toBeInstanceOf(
      ConvexError,
    );
    await expect(seedDefaultCategoriesHandler(ctx)).rejects.toMatchObject({
      data: "Not authenticated",
    });
  });

  it("初回ログイン時に 8 件が作成される（created: 8, skipped: 0）", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-first-login",
    });
    // existingDocs = [] → 全件 insert されるケース
    const ctx = createMutationCtx(identity, []);

    const result = await seedDefaultCategoriesHandler(ctx);

    expect(result).toEqual({ created: 8, skipped: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledTimes(8);

    // 最初の insert が "categories" テーブルへ食費を追加することを確認
    expect(dbInsert).toHaveBeenCalledWith(
      "categories",
      expect.objectContaining({
        userId: "https://issuer.example|user-first-login",
        name: "食費",
        color: "#FF6B6B",
        isActive: true,
        sortOrder: 1,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("2 回目以降は重複しない（created: 0, skipped: 8）", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-second-login",
    });

    // 8 件全て既存として渡す
    const existingDocs: CategoryDoc[] = [
      { _id: "id-1", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "食費",   color: "#FF6B6B", isActive: true, sortOrder: 1, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-2", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "日用品", color: "#4ECDC4", isActive: true, sortOrder: 2, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-3", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "外食",   color: "#FFE66D", isActive: true, sortOrder: 3, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-4", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "交通",   color: "#95E1D3", isActive: true, sortOrder: 4, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-5", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "医療",   color: "#F38181", isActive: true, sortOrder: 5, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-6", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "娯楽",   color: "#AA96DA", isActive: true, sortOrder: 6, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-7", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "衣服",   color: "#FCBAD3", isActive: true, sortOrder: 7, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-8", _creationTime: 1000, userId: "https://issuer.example|user-second-login", name: "その他", color: "#A8DADC", isActive: true, sortOrder: 8, createdAt: 1000, updatedAt: 1000 },
    ];

    const ctx = createMutationCtx(identity, existingDocs);

    const result = await seedDefaultCategoriesHandler(ctx);

    expect(result).toEqual({ created: 0, skipped: 8 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it("userId が異なるユーザーのカテゴリは分離される", async () => {
    const identityA = createIdentity({
      tokenIdentifier: "https://issuer.example|user-A",
    });
    const identityB = createIdentity({
      tokenIdentifier: "https://issuer.example|user-B",
    });

    // user-A のカテゴリのみ既存として用意
    const existingDocsForUserA: CategoryDoc[] = [
      { _id: "id-1", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "食費",   color: "#FF6B6B", isActive: true, sortOrder: 1, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-2", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "日用品", color: "#4ECDC4", isActive: true, sortOrder: 2, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-3", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "外食",   color: "#FFE66D", isActive: true, sortOrder: 3, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-4", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "交通",   color: "#95E1D3", isActive: true, sortOrder: 4, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-5", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "医療",   color: "#F38181", isActive: true, sortOrder: 5, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-6", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "娯楽",   color: "#AA96DA", isActive: true, sortOrder: 6, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-7", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "衣服",   color: "#FCBAD3", isActive: true, sortOrder: 7, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-8", _creationTime: 1000, userId: "https://issuer.example|user-A", name: "その他", color: "#A8DADC", isActive: true, sortOrder: 8, createdAt: 1000, updatedAt: 1000 },
    ];

    // user-A は全件既存 → skipped: 8
    const ctxA = createMutationCtx(identityA, existingDocsForUserA);
    const resultA = await seedDefaultCategoriesHandler(ctxA);
    expect(resultA).toEqual({ created: 0, skipped: 8 });

    // user-B は既存なし → created: 8（user-A のドキュメントは影響しない）
    const ctxB = createMutationCtx(identityB, []);
    const resultB = await seedDefaultCategoriesHandler(ctxB);
    expect(resultB).toEqual({ created: 8, skipped: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsertB = (ctxB.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsertB).toHaveBeenCalledTimes(8);
    // user-B の insert には user-B の userId が使われていること
    expect(dbInsertB).toHaveBeenCalledWith(
      "categories",
      expect.objectContaining({
        userId: "https://issuer.example|user-B",
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// listActive テスト
// ---------------------------------------------------------------------------

describe("listActive", () => {
  it("未認証時は ConvexError を throw する", async () => {
    const ctx = createQueryCtx(null);

    await expect(listActiveHandler(ctx)).rejects.toBeInstanceOf(ConvexError);
    await expect(listActiveHandler(ctx)).rejects.toMatchObject({
      data: "Not authenticated",
    });
  });

  it("認証済みの場合はアクティブなカテゴリ一覧を返す", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-list",
    });

    const docs: CategoryDoc[] = [
      { _id: "id-1", _creationTime: 1000, userId: "https://issuer.example|user-list", name: "食費",   color: "#FF6B6B", isActive: true, sortOrder: 1, createdAt: 1000, updatedAt: 1000 },
      { _id: "id-2", _creationTime: 1000, userId: "https://issuer.example|user-list", name: "日用品", color: "#4ECDC4", isActive: true, sortOrder: 2, createdAt: 1000, updatedAt: 1000 },
    ];

    const ctx = createQueryCtx(identity, docs);
    const result = await listActiveHandler(ctx);

    expect(result).toEqual(docs);
  });
});
