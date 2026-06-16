import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
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
  groupId: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

type GroupMemberDoc = {
  _id: string;
  _creationTime: number;
  groupId: Id<"groups">;
  userId: string;
  role: "owner" | "member";
};

/**
 * seedDefaultCategoriesHandler が必要とする MutationCtx の最小モックを生成する。
 *
 * - groupMembers テーブルへの withIndex("by_user_id") クエリは groupMember を返す
 * - categories テーブルへの withIndex は existingDocs から groupId/sortOrder でフィルタ
 */
function createMutationCtx(
  identity: UserIdentity | null,
  existingDocs: CategoryDoc[] = [],
  groupMember: GroupMemberDoc | null = identity
    ? {
        _id: "member-001",
        _creationTime: 1000,
        groupId: "group-001" as Id<"groups">,
        userId: identity.tokenIdentifier,
        role: "owner",
      }
    : null,
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-doc-id");
  const patchMock = vi.fn().mockResolvedValue(undefined);
  const getMock = vi.fn().mockImplementation(async (id: string) => {
    return existingDocs.find((doc) => doc._id === id) ?? null;
  });

  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      // groupMembers テーブル用のフィルタリング
      let capturedGroupId: string | null = null;
      let capturedIsActive: boolean | null = null;
      let capturedSortOrder: number | null = null;

      const q = {
        eq: vi.fn().mockImplementation((_field: string, _value: unknown) => {
          if (_field === "groupId") {
            capturedGroupId = _value as string;
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

      // builder を実行してフィールドをキャプチャさせる
      builder(q);

      // groupMembers テーブルのクエリは groupMember を返す
      if (_indexName === "by_user_id") {
        return {
          unique: vi.fn().mockResolvedValue(groupMember),
        };
      }

      // categories テーブルのクエリ: groupId/sortOrder でフィルタ
      const docs = existingDocs.filter((d) => {
        if (capturedGroupId !== null && d.groupId !== capturedGroupId) return false;
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
function createQueryCtx(
  identity: UserIdentity | null,
  docs: CategoryDoc[] = [],
  groupMember: GroupMemberDoc | null = identity
    ? {
        _id: "member-001",
        _creationTime: 1000,
        groupId: "group-001" as Id<"groups">,
        userId: identity.tokenIdentifier,
        role: "owner",
      }
    : null,
): QueryCtx {
  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      let capturedGroupId: string | null = null;
      let capturedIsActive: boolean | null = null;

      const q = {
        eq: vi.fn().mockImplementation((_field: string, _value: unknown) => {
          if (_field === "groupId") {
            capturedGroupId = _value as string;
          }
          if (_field === "isActive") {
            capturedIsActive = _value as boolean;
          }
          return q;
        }),
      };
      builder(q);

      // groupMembers テーブルのクエリ
      if (_indexName === "by_user_id") {
        return {
          unique: vi.fn().mockResolvedValue(groupMember),
        };
      }

      const filteredDocs = docs.filter((doc) => {
        if (capturedGroupId !== null && doc.groupId !== capturedGroupId) return false;
        if (capturedIsActive !== null && doc.isActive !== capturedIsActive) return false;
        return true;
      });

      const orderMock = vi.fn().mockImplementation((direction?: "asc" | "desc") => {
        const orderedDocs = [...filteredDocs].sort((a, b) => a.sortOrder - b.sortOrder);
        if (direction === "desc") {
          orderedDocs.reverse();
        }
        return {
          collect: vi.fn().mockResolvedValue(orderedDocs),
          take: vi
            .fn()
            .mockImplementation(async (limit?: number) =>
              typeof limit === "number" ? orderedDocs.slice(0, limit) : orderedDocs,
            ),
        };
      });
      const takeMock = vi
        .fn()
        .mockImplementation(async (limit?: number) =>
          typeof limit === "number" ? filteredDocs.slice(0, limit) : filteredDocs,
        );

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
        groupId: "group-001",
        name: "食費",
        color: "#8B5E3C",
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
        groupId: "group-001",
        name: "食費",
        color: "#8B5E3C",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        groupId: "group-001",
        name: "日用品",
        color: "#A6B28B",
        isActive: true,
        sortOrder: 2,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-3",
        _creationTime: 1000,
        groupId: "group-001",
        name: "外食",
        color: "#F4A27A",
        isActive: true,
        sortOrder: 3,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-4",
        _creationTime: 1000,
        groupId: "group-001",
        name: "交通",
        color: "#AAB7C4",
        isActive: true,
        sortOrder: 4,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-5",
        _creationTime: 1000,
        groupId: "group-001",
        name: "医療",
        color: "#C9734B",
        isActive: true,
        sortOrder: 5,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-6",
        _creationTime: 1000,
        groupId: "group-001",
        name: "娯楽",
        color: "#6F7F55",
        isActive: true,
        sortOrder: 6,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-7",
        _creationTime: 1000,
        groupId: "group-001",
        name: "衣服",
        color: "#D8B28F",
        isActive: true,
        sortOrder: 7,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-8",
        _creationTime: 1000,
        groupId: "group-001",
        name: "その他",
        color: "#765F4F",
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

  it("旧デフォルトカテゴリ色はSuzumemoパレットへ更新する", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-legacy-colors",
    });
    const existingDocs: CategoryDoc[] = [
      {
        _id: "id-legacy-food",
        _creationTime: 1000,
        groupId: "group-001",
        name: "食費",
        color: "#FF6B6B",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const ctx = createMutationCtx(identity, existingDocs);

    const result = await seedDefaultCategoriesHandler(ctx);

    expect(result).toEqual({ created: 7, skipped: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith("id-legacy-food", {
      color: "#8B5E3C",
      updatedAt: expect.any(Number),
    });
  });

  it("ユーザーが変更したカテゴリ色は上書きしない", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-custom-color",
    });
    const existingDocs: CategoryDoc[] = [
      {
        _id: "id-custom-food",
        _creationTime: 1000,
        groupId: "group-001",
        name: "食費",
        color: "#000000",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];
    const ctx = createMutationCtx(identity, existingDocs);

    const result = await seedDefaultCategoriesHandler(ctx);

    expect(result).toEqual({ created: 7, skipped: 1 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).not.toHaveBeenCalled();
  });

  it("groupId が異なるグループのカテゴリは分離される", async () => {
    const identityA = createIdentity({
      tokenIdentifier: "https://issuer.example|user-A",
    });
    const identityB = createIdentity({
      tokenIdentifier: "https://issuer.example|user-B",
    });

    const groupMemberA: GroupMemberDoc = {
      _id: "member-A",
      _creationTime: 1000,
      groupId: "group-A" as Id<"groups">,
      userId: identityA.tokenIdentifier,
      role: "owner",
    };
    const groupMemberB: GroupMemberDoc = {
      _id: "member-B",
      _creationTime: 1000,
      groupId: "group-B" as Id<"groups">,
      userId: identityB.tokenIdentifier,
      role: "owner",
    };

    // group-A のカテゴリのみ既存として用意
    const existingDocsForGroupA: CategoryDoc[] = [
      {
        _id: "id-1",
        _creationTime: 1000,
        groupId: "group-A",
        name: "食費",
        color: "#8B5E3C",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        groupId: "group-A",
        name: "日用品",
        color: "#A6B28B",
        isActive: true,
        sortOrder: 2,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-3",
        _creationTime: 1000,
        groupId: "group-A",
        name: "外食",
        color: "#F4A27A",
        isActive: true,
        sortOrder: 3,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-4",
        _creationTime: 1000,
        groupId: "group-A",
        name: "交通",
        color: "#AAB7C4",
        isActive: true,
        sortOrder: 4,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-5",
        _creationTime: 1000,
        groupId: "group-A",
        name: "医療",
        color: "#C9734B",
        isActive: true,
        sortOrder: 5,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-6",
        _creationTime: 1000,
        groupId: "group-A",
        name: "娯楽",
        color: "#6F7F55",
        isActive: true,
        sortOrder: 6,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-7",
        _creationTime: 1000,
        groupId: "group-A",
        name: "衣服",
        color: "#D8B28F",
        isActive: true,
        sortOrder: 7,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-8",
        _creationTime: 1000,
        groupId: "group-A",
        name: "その他",
        color: "#765F4F",
        isActive: true,
        sortOrder: 8,
        createdAt: 1000,
        updatedAt: 1000,
      },
    ];

    // group-A は全件既存 → skipped: 8
    const ctxA = createMutationCtx(identityA, existingDocsForGroupA, groupMemberA);
    const resultA = await seedDefaultCategoriesHandler(ctxA);
    expect(resultA).toEqual({ created: 0, skipped: 8 });

    // group-B は既存なし → created: 8（group-A のドキュメントは影響しない）
    const ctxB = createMutationCtx(identityB, [], groupMemberB);
    const resultB = await seedDefaultCategoriesHandler(ctxB);
    expect(resultB).toEqual({ created: 8, skipped: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsertB = (ctxB.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsertB).toHaveBeenCalledTimes(8);
    // group-B の insert には group-B の groupId が使われていること
    expect(dbInsertB).toHaveBeenCalledWith(
      "categories",
      expect.objectContaining({
        groupId: "group-B",
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
        groupId: "group-001",
        name: "食費",
        color: "#8B5E3C",
        isActive: false,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        groupId: "group-001",
        name: "日用品",
        color: "#A6B28B",
        isActive: true,
        sortOrder: 2,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-3",
        _creationTime: 1000,
        groupId: "group-001",
        name: "外食",
        color: "#F4A27A",
        isActive: true,
        sortOrder: 3,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-4",
        _creationTime: 1000,
        groupId: "group-001",
        name: "交通",
        color: "#AAB7C4",
        isActive: true,
        sortOrder: 4,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-5",
        _creationTime: 1000,
        groupId: "group-001",
        name: "医療",
        color: "#C9734B",
        isActive: true,
        sortOrder: 5,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-6",
        _creationTime: 1000,
        groupId: "group-001",
        name: "娯楽",
        color: "#6F7F55",
        isActive: true,
        sortOrder: 6,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-7",
        _creationTime: 1000,
        groupId: "group-001",
        name: "衣服",
        color: "#D8B28F",
        isActive: true,
        sortOrder: 7,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-8",
        _creationTime: 1000,
        groupId: "group-001",
        name: "その他",
        color: "#765F4F",
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
        groupId: "group-001",
        name: "食費",
        color: "#8B5E3C",
        isActive: true,
        sortOrder: 1,
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        _id: "id-2",
        _creationTime: 1000,
        groupId: "group-001",
        name: "日用品",
        color: "#A6B28B",
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
  const GROUP_ID = "group-cat-mgmt" as Id<"groups">;
  const OTHER_GROUP_ID = "group-other" as Id<"groups">;

  const identityOwner = createIdentity({
    tokenIdentifier: "https://issuer.example|category-user",
  });

  const groupMemberOwner: GroupMemberDoc = {
    _id: "member-owner",
    _creationTime: 1000,
    groupId: GROUP_ID,
    userId: identityOwner.tokenIdentifier,
    role: "owner",
  };

  const activeCategory: CategoryDoc = {
    _id: "cat-active",
    _creationTime: 1000,
    groupId: GROUP_ID,
    name: "食費",
    color: "#8B5E3C",
    isActive: true,
    sortOrder: 1,
    createdAt: 1000,
    updatedAt: 1000,
  };

  const inactiveCategory: CategoryDoc = {
    ...activeCategory,
    _id: "cat-inactive",
    name: "旧カテゴリ",
    color: "#765F4F",
    isActive: false,
    sortOrder: 2,
  };

  it("listForSettings は inactive を含むカテゴリ一覧を返す", async () => {
    const docs = [activeCategory, inactiveCategory];
    const ctx = createQueryCtx(identityOwner, docs, groupMemberOwner);

    const result = await listForSettingsHandler(ctx);

    expect(result).toEqual(docs);
  });

  it("createCategory は既存最大 sortOrder の次でカテゴリを作成する", async () => {
    const ctx = createMutationCtx(
      identityOwner,
      [activeCategory, inactiveCategory],
      groupMemberOwner,
    );

    await createCategoryHandler(ctx, {
      name: "ペット用品",
      color: "#AAB7C4",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "categories",
      expect.objectContaining({
        groupId: GROUP_ID,
        name: "ペット用品",
        color: "#AAB7C4",
        isActive: true,
        sortOrder: 3,
      }),
    );
  });

  it("createCategory はカテゴリが100件以上ある場合は拒否する", async () => {
    const existingDocs: CategoryDoc[] = Array.from({ length: 100 }, (_, index) => ({
      ...activeCategory,
      _id: `cat-${index + 1}`,
      name: `カテゴリ${index + 1}`,
      sortOrder: index + 1,
    }));
    const ctx = createMutationCtx(identityOwner, existingDocs, groupMemberOwner);

    await expect(
      createCategoryHandler(ctx, {
        name: "上限超過",
        color: "#AAB7C4",
      }),
    ).rejects.toMatchObject({
      data: "Category limit reached",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it("updateCategory は所有カテゴリの名前と色を更新する", async () => {
    const ctx = createMutationCtx(identityOwner, [activeCategory], groupMemberOwner);

    await updateCategoryHandler(ctx, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categoryId: "cat-active" as any,
      name: "食料品",
      color: "#8B5E3C",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "cat-active",
      expect.objectContaining({
        name: "食料品",
        color: "#8B5E3C",
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("deactivateCategory は所有カテゴリを無効化する", async () => {
    const ctx = createMutationCtx(identityOwner, [activeCategory], groupMemberOwner);

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

  it("他グループのカテゴリは更新できない", async () => {
    const otherGroupCategory: CategoryDoc = {
      ...activeCategory,
      groupId: OTHER_GROUP_ID,
    };
    const ctx = createMutationCtx(identityOwner, [otherGroupCategory], groupMemberOwner);

    await expect(
      updateCategoryHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-active" as any,
        name: "不正更新",
        color: "#000000",
      }),
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("他グループのカテゴリは無効化できない", async () => {
    const otherGroupCategory: CategoryDoc = {
      ...activeCategory,
      groupId: OTHER_GROUP_ID,
    };
    const ctx = createMutationCtx(identityOwner, [otherGroupCategory], groupMemberOwner);

    await expect(
      deactivateCategoryHandler(ctx, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categoryId: "cat-active" as any,
      }),
    ).rejects.toBeInstanceOf(ConvexError);
  });
});
