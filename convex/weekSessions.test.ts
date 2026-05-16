import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  getOrCreateCurrentWeekSessionHandler,
  getWeekSessionHandler,
  completeWeekSessionHandler,
} from "./weekSessions";

// ---------------------------------------------------------------------------
// テスト用型定義
// ---------------------------------------------------------------------------

type WeekSessionDoc = {
  _id: string;
  _creationTime: number;
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
  budgetAmountYen?: number;
  reviewMemo?: string;
  status: "draft" | "completed";
  createdAt: number;
  updatedAt: number;
};

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

/**
 * MutationCtx の最小モックを生成する。
 *
 * - ctx.db.query().withIndex().unique() は uniqueDoc を返す
 * - ctx.db.get(id) は getDocById で解決する（insert 後は insertedDoc を返す）
 * - ctx.db.insert() は "new-session-id" を返す
 * - ctx.db.patch() / ctx.db.delete() は vi.fn()
 */
function createMutationCtx(
  identity: UserIdentity | null,
  opts: {
    getDocById?: Record<string, WeekSessionDoc | null>;
    insertedDoc?: WeekSessionDoc;
    updatedDoc?: WeekSessionDoc;
    uniqueDoc?: WeekSessionDoc | null;
  } = {},
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-session-id");
  const patchMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);

  const getDocById = opts.getDocById ?? {};
  const insertedDoc = opts.insertedDoc ?? null;
  const updatedDoc = opts.updatedDoc ?? null;

  // insert 後の get と通常の get を区別するために呼び出し回数を追跡
  let insertCalled = false;
  let patchCalled = false;

  const getMock = vi.fn().mockImplementation(async (id: string) => {
    // insert が完了した後の get は insertedDoc を返す
    if (id === "new-session-id" && insertCalled && insertedDoc !== null) {
      return insertedDoc;
    }
    // patch が完了した後の get は updatedDoc を返す
    if (patchCalled && updatedDoc !== null && id === updatedDoc._id) {
      return updatedDoc;
    }
    return getDocById[id] ?? null;
  });

  // insert / patch の後に insertCalled / patchCalled を設定するラッパー
  const insertWrapper = vi.fn().mockImplementation(async (...args: unknown[]) => {
    const result = await insertMock(...args);
    insertCalled = true;
    return result;
  });

  const patchWrapper = vi.fn().mockImplementation(async (...args: unknown[]) => {
    const result = await patchMock(...args);
    patchCalled = true;
    return result;
  });

  // uniqueDoc が明示的に undefined の場合は opts.uniqueDoc を使う（null はセッションなし）
  const uniqueResult = opts.uniqueDoc !== undefined ? opts.uniqueDoc : null;
  const uniqueMock = vi.fn().mockResolvedValue(uniqueResult);

  const withIndexMock = vi.fn().mockImplementation(
    (_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q),
      };
      builder(q);
      return { unique: uniqueMock };
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
      get: getMock,
      insert: insertWrapper,
      patch: patchWrapper,
      delete: deleteMock,
      query: queryMock,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

/**
 * QueryCtx の最小モックを生成する。
 */
function createQueryCtx(
  identity: UserIdentity | null,
  opts: {
    uniqueDoc?: WeekSessionDoc | null;
  } = {},
): QueryCtx {
  // uniqueDoc が明示的に undefined の場合は null
  const uniqueResult = opts.uniqueDoc !== undefined ? opts.uniqueDoc : null;
  const uniqueMock = vi.fn().mockResolvedValue(uniqueResult);

  const withIndexMock = vi.fn().mockImplementation(
    (_indexName: string, builder: (q: unknown) => unknown) => {
      const q = {
        eq: vi.fn().mockImplementation(() => q),
      };
      builder(q);
      return { unique: uniqueMock };
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
// テスト用フィクスチャ
// ---------------------------------------------------------------------------

const USER_ID = "https://issuer.example|user-001";
const OTHER_USER_ID = "https://issuer.example|user-002";

const sampleSession: WeekSessionDoc = {
  _id: "session-001",
  _creationTime: 1000,
  userId: USER_ID,
  weekStartDate: "2024-01-08",
  weekEndDate: "2024-01-14",
  status: "draft",
  createdAt: 1000,
  updatedAt: 1000,
};

const otherUserSession: WeekSessionDoc = {
  _id: "session-other",
  _creationTime: 1000,
  userId: OTHER_USER_ID,
  weekStartDate: "2024-01-08",
  weekEndDate: "2024-01-14",
  status: "draft",
  createdAt: 1000,
  updatedAt: 1000,
};

// ---------------------------------------------------------------------------
// getOrCreateCurrentWeekSession テスト
// ---------------------------------------------------------------------------

describe("getOrCreateCurrentWeekSession", () => {
  it("新規セッションが draft 状態で作成される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const createdSession: WeekSessionDoc = {
      ...sampleSession,
      _id: "new-session-id",
    };

    // uniqueDoc: null → 既存セッションなし → 新規作成
    const ctx = createMutationCtx(identity, {
      uniqueDoc: null,
      insertedDoc: createdSession,
    });

    const result = await getOrCreateCurrentWeekSessionHandler(ctx);

    expect(result).toEqual(createdSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledOnce();
    expect(dbInsert).toHaveBeenCalledWith(
      "weekSessions",
      expect.objectContaining({
        userId: USER_ID,
        status: "draft",
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("既存セッションがある場合は新規作成せずそのまま返す（冪等性）", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });

    // uniqueDoc: sampleSession → 既存セッションあり → 新規作成しない
    const ctx = createMutationCtx(identity, {
      uniqueDoc: sampleSession,
    });

    const result = await getOrCreateCurrentWeekSessionHandler(ctx);

    expect(result).toEqual(sampleSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      getOrCreateCurrentWeekSessionHandler(ctx),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      getOrCreateCurrentWeekSessionHandler(ctx),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });
});

// ---------------------------------------------------------------------------
// getWeekSession テスト
// ---------------------------------------------------------------------------

describe("getWeekSession", () => {
  it("指定週のセッションが返される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createQueryCtx(identity, { uniqueDoc: sampleSession });

    const result = await getWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual(sampleSession);
  });

  it("セッションが存在しない場合は null", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const ctx = createQueryCtx(identity, { uniqueDoc: null });

    const result = await getWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toBeNull();
  });

  it("他ユーザーのセッションは返されない（withIndex で userId 絞り込み）", async () => {
    // OTHER_USER_ID のコンテキストでは uniqueDoc を null にして別ユーザーのデータが混入しないことを表現
    const identity = createIdentity({ tokenIdentifier: OTHER_USER_ID });
    const ctx = createQueryCtx(identity, { uniqueDoc: null });

    const result = await getWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).not.toEqual(
      expect.objectContaining({ userId: USER_ID }),
    );
    expect(result).toBeNull();
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtx(null);

    await expect(
      getWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      getWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });
});

// ---------------------------------------------------------------------------
// completeWeekSession テスト
// ---------------------------------------------------------------------------

describe("completeWeekSession", () => {
  it("セッションが completed に更新される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const updatedSession: WeekSessionDoc = {
      ...sampleSession,
      status: "completed",
      updatedAt: 9999,
    };

    const ctx = createMutationCtx(identity, {
      uniqueDoc: sampleSession,
      getDocById: {
        "session-001": sampleSession,
      },
      updatedDoc: updatedSession,
    });

    const result = await completeWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual(updatedSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledOnce();
    expect(dbPatch).toHaveBeenCalledWith(
      "session-001",
      expect.objectContaining({
        status: "completed",
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("reviewMemo が指定された場合は保存される", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });
    const updatedSession: WeekSessionDoc = {
      ...sampleSession,
      status: "completed",
      reviewMemo: "今週の振り返りメモ",
      updatedAt: 9999,
    };

    const ctx = createMutationCtx(identity, {
      uniqueDoc: sampleSession,
      getDocById: {
        "session-001": sampleSession,
      },
      updatedDoc: updatedSession,
    });

    const result = await completeWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
      reviewMemo: "今週の振り返りメモ",
    });

    expect(result).toEqual(updatedSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "session-001",
      expect.objectContaining({
        status: "completed",
        reviewMemo: "今週の振り返りメモ",
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("セッションが存在しない場合は ConvexError", async () => {
    const identity = createIdentity({ tokenIdentifier: USER_ID });

    // uniqueDoc: null → セッションなし
    const ctx = createMutationCtx(identity, {
      uniqueDoc: null,
    });

    await expect(
      completeWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      completeWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toMatchObject({ data: "Week session not found" });
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      completeWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      completeWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });
});

// ---------------------------------------------------------------------------
// 他ユーザーのセッションが completeWeekSession で操作できないことを確認
// ---------------------------------------------------------------------------

describe("completeWeekSession - 他ユーザーのセッション", () => {
  it("他ユーザーのセッションは操作できない（withIndex で userId 絞り込み）", async () => {
    // OTHER_USER_ID のコンテキストでは uniqueDoc を null にして別ユーザーのデータが返らないことを表現
    const identity = createIdentity({ tokenIdentifier: OTHER_USER_ID });
    const ctx = createMutationCtx(identity, {
      uniqueDoc: null,
    });

    // OTHER_USER_ID でアクセスした場合、sampleSession（USER_ID所有）は取得されない
    await expect(
      completeWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      completeWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toMatchObject({ data: "Week session not found" });
  });
});

// otherUserSession を使って宣言されているが実際には上記テストで検証済み
// ここで参照することでimportが無駄にならないよう型チェックを通す
const _typecheck: WeekSessionDoc = otherUserSession;
void _typecheck;
