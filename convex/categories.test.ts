import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  createCategoryHandler,
  deactivateCategoryHandler,
  listForSettingsHandler,
  seedDefaultCategoriesHandler,
  listActiveHandler,
  updateCategoryHandler,
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
  const patchMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn().mockImplementation(async (id: string) => {
    return existingDocs.find((doc) => doc._id === id) ?? null;
  });

  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      // builder: (q) => q.eq("userId", ...).eq("isActive", ...).eq("sortOrder", ...)
      // 各 eq の呼び出しで sortOrder の値をキャプチャし、unique() に紐付ける
      let capturedUserId: string | null = null;
      let capturedIsActive: boolean | null = null;
      let capturedSortOrder: number | null = null;

      const q = {
        eq: vi.fn().mockImplementation((_field: string, _value: unknown) => {
          if (_field === "userId") {
            capturedUserId = _value as string;
          }
          if (_field === "isActive") {
            capturedIsActive = _value as boolean;
          }
          if (_field === "sortOrder") {
            capturedSortOrder = _value as number;
          }
          return q; // self-referential chain
        }),
      };

      // builder を実行して sortOrder をキャプチャさせる
      builder(q);

      // unique() は capturedSortOrder に対応するドキュメントを返す
      const docs = existingDocs.filter((d) => {
        if (capturedUserId !== null && d.userId !== capturedUserId) return false;
        if (capturedIsActive !== null && d.isActive !== capturedIsActive) return false;
        if (capturedSortOrder !== null && d.sortOrder !== capturedSortOrder) return false;
        return true;
      });

      const chain: Record<string, unknown> = {
        collect: vi.fn().mockResolvedValue(docs),
        first: vi.fn().mockResolvedValue(docs[0] ?? null),
        take: vi.fn().mockImplementation(async (limit?: number) => {
          return typeof limit === "number" ? docs.slice(0, limit) : docs;
        }),
        unique: vi.fn().mockResolvedValue(docs[0] ?? null),
      };
      chain.order = vi.fn().mockImplementation((direction?: "asc" | "desc") => {
        const sortedDocs = [...docs].sort((a, b) => a.sortOrder - b.sortOrder);
        const orderedDocs = direction === "desc" ? sortedDocs.reverse() : sortedDocs;
        return {
          collect: vi.fn().mockResolvedValue(orderedDocs),
          first: vi.fn().mockResolvedValue(orderedDocs[0] ?? null),
          take: vi.fn().mockImplementation(async (limit?: number) => {
            return typeof limit === "number" ? orderedDocs.slice(0, limit) : orderedDocs;
          }),
          unique: vi.fn().mockResolvedValue(orderedDocs[0] ?? null),
        };
      });
      return chain;
    });

  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
    },
    db: {
      get: getMock,
      query: queryMock,
      insert: insertMock,
      patch: patchMock,
    },
    // TODO: MutationCtx の完全な型を満たす型安全なモックファクトリーへの置き換えを検討する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

/**
 * listActiveHandler が必要とする QueryCtx の最小モックを生成する。
 */
function createQueryCtx(identity: UserIdentity | null, docs: CategoryDoc[] = []): QueryCtx {
  const collectMock = vi.fn().mockResolvedValue(docs);
  const takeMock = vi.fn().mockResolvedValue(docs);
  const orderMock = vi.fn().mockReturnValue({ collect: collectMock, take: takeMock });

  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q), // self-referential chain
      };
      builder(q);
      return { order: orderMock, take: takeMock };
    });

  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
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

    await expect(seedDefaultCategoriesHandler(ctx)).rejects.toBeInstanceOf(ConvexError);
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
      {
        _id: "id-1",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "食費",
        color: "#FF6B6B",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "日用品",
        color: "#4ECDC4",
        isActive: true,
        sortOrder: 2,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-3",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "外食",
        color: "#FFE66D",
        isActive: true,
        sortOrder: 3,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-4",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "交通",
        color: "#95E1D3",
        isActive: true,
        sortOrder: 4,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-5",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "医療",
        color: "#F38181",
        isActive: true,
        sortOrder: 5,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-6",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "娯楽",
        color: "#AA96DA",
        isActive: true,
        sortOrder: 6,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-7",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "衣服",
        color: "#FCBAD3",
        isActive: true,
        sortOrder: 7,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-8",
        _creationTime: 1000,
        userId: "https://issuer.example|user-second-login",
        name: "その他",
        color: "#A8DADC",
        isActive: true,
        sortOrder: 8,
        createdAt: 1000,
        updatedAt: 1000,
      },
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
      {
        _id: "id-1",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "食費",
        color: "#FF6B6B",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "日用品",
        color: "#4ECDC4",
        isActive: true,
        sortOrder: 2,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-3",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "外食",
        color: "#FFE66D",
        isActive: true,
        sortOrder: 3,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-4",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "交通",
        color: "#95E1D3",
        isActive: true,
        sortOrder: 4,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-5",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "医療",
        color: "#F38181",
        isActive: true,
        sortOrder: 5,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-6",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "娯楽",
        color: "#AA96DA",
        isActive: true,
        sortOrder: 6,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-7",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "衣服",
        color: "#FCBAD3",
        isActive: true,
        sortOrder: 7,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-8",
        _creationTime: 1000,
        userId: "https://issuer.example|user-A",
        name: "その他",
        color: "#A8DADC",
        isActive: true,
        sortOrder: 8,
        createdAt: 1000,
        updatedAt: 1000,
      },
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

  it("無効化済みカテゴリがある場合はデフォルトカテゴリを再作成しない", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-deactivated-default",
    });

    const existingDocs: CategoryDoc[] = [
      {
        _id: "id-1",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "食費",
        color: "#FF6B6B",
        isActive: false,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "日用品",
        color: "#4ECDC4",
        isActive: true,
        sortOrder: 2,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-3",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "外食",
        color: "#FFE66D",
        isActive: true,
        sortOrder: 3,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-4",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "交通",
        color: "#95E1D3",
        isActive: true,
        sortOrder: 4,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-5",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "医療",
        color: "#F38181",
        isActive: true,
        sortOrder: 5,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-6",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "娯楽",
        color: "#AA96DA",
        isActive: true,
        sortOrder: 6,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-7",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "衣服",
        color: "#FCBAD3",
        isActive: true,
        sortOrder: 7,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-8",
        _creationTime: 1000,
        userId: "https://issuer.example|user-deactivated-default",
        name: "その他",
        color: "#A8DADC",
        isActive: true,
        sortOrder: 8,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    const ctx = createMutationCtx(identity, existingDocs);

    const result = await seedDefaultCategoriesHandler(ctx);

    expect(result).toEqual({ created: 0, skipped: 8 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).not.toHaveBeenCalled();
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
      {
        _id: "id-1",
        _creationTime: 1000,
        userId: "https://issuer.example|user-list",
        name: "食費",
        color: "#FF6B6B",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        userId: "https://issuer.example|user-list",
        name: "日用品",
        color: "#4ECDC4",
        isActive: true,
        sortOrder: 2,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    const ctx = createQueryCtx(identity, docs);
    const result = await listActiveHandler(ctx);

    expect(result).toEqual(docs);
  });
});

// ---------------------------------------------------------------------------
// listForSettings / create / update / deactivate テスト
// ---------------------------------------------------------------------------

describe("category management", () => {
  const USER_ID = "https://issuer.example|category-user";
  const OTHER_USER_ID = "https://issuer.example|other-user";

  const activeCategory: CategoryDoc = {
    _id: "cat-active",
    _creationTime: 1000,
    userId: USER_ID,
    name: "食費",
    color: "#FF6B6B",
    isActive: true,
    sortOrder: 1,
    createdAt: 1000,
    updatedAt: 1000,
  };

  const inactiveCategory: CategoryDoc = {
    ...activeCategory,
    _id: "cat-inactive",
    name: "旧カテゴリ",
    color: "#64748B",
    isActive: false,
    sortOrder: 2,
  };

  it("listForSettings は inactive を含むカテゴリ一覧を返す", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const docs = [activeCategory, inactiveCategory];
    const ctx = createQueryCtx(identity, docs);

    const result = await listForSettingsHandler(ctx);

    expect(result).toEqual(docs);
  });

  it("createCategory は既存最大 sortOrder の次でカテゴリを作成する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, [activeCategory, inactiveCategory]);

    await createCategoryHandler(ctx, {
      name: "ペット用品",
      color: "#2563EB",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "categories",
      expect.objectContaining({
        userId: USER_ID,
        name: "ペット用品",
        color: "#2563EB",
        isActive: true,
        sortOrder: 3,
      }),
    );
  });

  it("createCategory はカテゴリが100件以上ある場合は拒否する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const existingDocs: CategoryDoc[] = Array.from({ length: 100 }, (_, index) => ({
      ...activeCategory,
      _id: `cat-${index + 1}`,
      name: `カテゴリ${index + 1}`,
      sortOrder: index + 1,
    }));
    const ctx = createMutationCtx(identity, existingDocs);

    await expect(
      createCategoryHandler(ctx, {
        name: "上限超過",
        color: "#2563EB",
      }),
    ).rejects.toMatchObject({
      data: "Category limit reached",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it("updateCategory は所有カテゴリの名前と色を更新する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, [activeCategory]);

    await updateCategoryHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "cat-active" as any,
      name: "食料品",
      color: "#0F766E",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "cat-active",
      expect.objectContaining({
        name: "食料品",
        color: "#0F766E",
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("deactivateCategory は所有カテゴリを無効化する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, [activeCategory]);

    await deactivateCategoryHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "cat-active" as any,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "cat-active",
      expect.objectContaining({
        isActive: false,
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("他ユーザーのカテゴリ更新は拒否する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, [
      { ...activeCategory, _id: "cat-other", userId: OTHER_USER_ID },
    ]);

    await expect(
      updateCategoryHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-other" as any,
        name: "変更不可",
        color: "#0F766E",
      }),
    ).rejects.toMatchObject({
      data: "Category does not belong to the current user",
    });
  });

  it("他ユーザーのカテゴリ無効化は拒否する", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createMutationCtx(identity, [
      { ...activeCategory, _id: "cat-other", userId: OTHER_USER_ID },
    ]);

    await expect(
      deactivateCategoryHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-other" as any,
      }),
    ).rejects.toMatchObject({
      data: "Category does not belong to the current user",
    });
  });
});
