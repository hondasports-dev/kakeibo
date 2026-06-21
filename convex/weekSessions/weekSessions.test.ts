import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { getWeekSessionHandler } from "./queries";
import {
  getOrCreateCurrentWeekSessionHandler,
  getOrCreateWeekSessionHandler,
  updateReviewMemoHandler,
  completeWeekSessionHandler,
} from "./mutations";
import { resetWeekSessionForUserHandler } from "./internal";

// ---------------------------------------------------------------------------
// テスト用型定義
// ---------------------------------------------------------------------------

type WeekSessionDoc = {
  _id: string;
  _creationTime: number;
  groupId: string;
  weekStartDate: string;
  weekEndDate: string;
  reviewMemo?: string;
  status: "draft" | "completed";
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

// ---------------------------------------------------------------------------
// テスト用ヘルパー
// ---------------------------------------------------------------------------

function createIdentity(overrides: Partial<UserIdentity> = {}): UserIdentity {
  return {
    tokenIdentifier: USER_ID,
    subject: "user-001",
    issuer: "https://issuer.example",
    ...overrides,
  };
}

const USER_ID = "https://issuer.example|user-001";
const OTHER_USER_ID = "https://issuer.example|user-002";
const GROUP_ID = "group-001";
const OTHER_GROUP_ID = "group-002";

/**
 * MutationCtx の最小モックを生成する。
 *
 * - groupMembers テーブルへの withIndex("by_user_id") クエリは groupMember を返す
 * - weekSessions テーブルへの withIndex は uniqueDoc を返す
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
    sessions?: WeekSessionDoc[];
    groupMember?: GroupMemberDoc | null;
  } = {},
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-session-id");
  const patchMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);

  const getDocById = opts.getDocById ?? {};
  const insertedDoc = opts.insertedDoc ?? null;
  const updatedDoc = opts.updatedDoc ?? null;

  const defaultGroupMember: GroupMemberDoc | null =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId: GROUP_ID as Id<"groups">,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;
  const groupMember = "groupMember" in opts ? opts.groupMember : defaultGroupMember;

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

  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      const filters: Record<string, unknown> = {};
      const q = {
        eq: vi.fn().mockImplementation((field: string, value: unknown) => {
          filters[field] = value;
          return q;
        }),
      };
      builder(q);

      // groupMembers テーブルのクエリ
      if (_indexName === "by_user_id") {
        return {
          unique: vi
            .fn()
            .mockResolvedValue(
              groupMember && filters.userId === groupMember.userId ? groupMember : null,
            ),
        };
      }

      if (_indexName === "by_group_id_and_week_start_date") {
        if (opts.sessions === undefined) {
          return { unique: uniqueMock };
        }
        const matched =
          opts.sessions.find(
            (session) =>
              session.groupId === filters.groupId &&
              session.weekStartDate === filters.weekStartDate,
          ) ?? null;
        return { unique: vi.fn().mockResolvedValue(matched) };
      }

      return { unique: uniqueMock };
    });
  const queryMock = vi.fn().mockReturnValue({ withIndex: withIndexMock });

  return {
    auth: {
      getUserIdentity: vi.fn<() => Promise<UserIdentity | null>>().mockResolvedValue(identity),
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
    sessions?: WeekSessionDoc[];
    groupMember?: GroupMemberDoc | null;
  } = {},
): QueryCtx {
  const defaultGroupMember: GroupMemberDoc | null =
    identity !== null
      ? {
          _id: "member-001",
          _creationTime: 1000,
          groupId: GROUP_ID as Id<"groups">,
          userId: identity.tokenIdentifier,
          role: "owner",
        }
      : null;
  const groupMember = "groupMember" in opts ? opts.groupMember : defaultGroupMember;

  // uniqueDoc が明示的に undefined の場合は null
  const uniqueResult = opts.uniqueDoc !== undefined ? opts.uniqueDoc : null;
  const uniqueMock = vi.fn().mockResolvedValue(uniqueResult);

  const withIndexMock = vi
    .fn()
    .mockImplementation((_indexName: string, builder: (q: unknown) => unknown) => {
      const filters: Record<string, unknown> = {};
      const q = {
        eq: vi.fn().mockImplementation((field: string, value: unknown) => {
          filters[field] = value;
          return q;
        }),
      };
      builder(q);

      // groupMembers テーブルのクエリ
      if (_indexName === "by_user_id") {
        return {
          unique: vi
            .fn()
            .mockResolvedValue(
              groupMember && filters.userId === groupMember.userId ? groupMember : null,
            ),
        };
      }

      if (_indexName === "by_group_id_and_week_start_date") {
        if (opts.sessions === undefined) {
          return { unique: uniqueMock };
        }
        const matched =
          opts.sessions.find(
            (session) =>
              session.groupId === filters.groupId &&
              session.weekStartDate === filters.weekStartDate,
          ) ?? null;
        return { unique: vi.fn().mockResolvedValue(matched) };
      }

      return { unique: uniqueMock };
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
// テスト用フィクスチャ
// ---------------------------------------------------------------------------

const sampleSession: WeekSessionDoc = {
  _id: "session-001",
  _creationTime: 1000,
  groupId: GROUP_ID,
  weekStartDate: "2024-01-08",
  weekEndDate: "2024-01-14",
  status: "draft",
  createdAt: 1000,
  updatedAt: 1000,
};

const otherGroupSession: WeekSessionDoc = {
  _id: "session-other",
  _creationTime: 1000,
  groupId: OTHER_GROUP_ID,
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
    const identity = createIdentity();
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
        groupId: GROUP_ID,
        status: "draft",
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("既存セッションがある場合は新規作成せずそのまま返す（冪等性）", async () => {
    const identity = createIdentity();

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

    await expect(getOrCreateCurrentWeekSessionHandler(ctx)).rejects.toBeInstanceOf(ConvexError);

    await expect(getOrCreateCurrentWeekSessionHandler(ctx)).rejects.toMatchObject({
      data: "Not authenticated",
    });
  });
});

// ---------------------------------------------------------------------------
// getWeekSession テスト
// ---------------------------------------------------------------------------

describe("getWeekSession", () => {
  it("指定週のセッションが返される", async () => {
    const identity = createIdentity();
    const ctx = createQueryCtx(identity, { uniqueDoc: sampleSession });

    const result = await getWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual(sampleSession);
  });

  it("セッションが存在しない場合は null", async () => {
    const identity = createIdentity();
    const ctx = createQueryCtx(identity, { uniqueDoc: null });

    const result = await getWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toBeNull();
  });

  it("現在グループのセッションだけを返す（withIndex で groupId 絞り込み）", async () => {
    const identityOther = createIdentity({ tokenIdentifier: OTHER_USER_ID });
    const otherGroupMember = {
      _id: "member-other",
      _creationTime: 1000,
      groupId: OTHER_GROUP_ID as Id<"groups">,
      userId: identityOther.tokenIdentifier,
      role: "owner" as const,
    };
    const ctx = createQueryCtx(identityOther, {
      sessions: [sampleSession, otherGroupSession],
      groupMember: otherGroupMember,
    });

    const result = await getWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual(otherGroupSession);
    expect(result).not.toEqual(expect.objectContaining({ groupId: GROUP_ID }));
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createQueryCtx(null);

    await expect(
      getWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(getWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" })).rejects.toMatchObject(
      { data: "Not authenticated" },
    );
  });
});

// ---------------------------------------------------------------------------
// updateReviewMemo テスト
// ---------------------------------------------------------------------------

describe("updateReviewMemo", () => {
  it("振り返りメモが保存される", async () => {
    const identity = createIdentity();
    const updatedSession: WeekSessionDoc = {
      ...sampleSession,
      reviewMemo: "食費が多めだったので来週は作り置きを増やす",
      updatedAt: 9999,
    };

    const ctx = createMutationCtx(identity, {
      uniqueDoc: sampleSession,
      getDocById: {
        "session-001": sampleSession,
      },
      updatedDoc: updatedSession,
    });

    const result = await updateReviewMemoHandler(ctx, {
      weekStartDate: "2024-01-08",
      reviewMemo: "食費が多めだったので来週は作り置きを増やす",
    });

    expect(result).toEqual(updatedSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledOnce();
    expect(dbPatch).toHaveBeenCalledWith(
      "session-001",
      expect.objectContaining({
        reviewMemo: "食費が多めだったので来週は作り置きを増やす",
        updatedAt: expect.any(Number),
      }),
    );
    expect(dbPatch).not.toHaveBeenCalledWith(
      "session-001",
      expect.objectContaining({
        status: expect.any(String),
      }),
    );
  });

  it("完了済みセッションでも status を維持したまま振り返りメモを再編集できる", async () => {
    const identity = createIdentity();
    const completedSession: WeekSessionDoc = {
      ...sampleSession,
      status: "completed",
      reviewMemo: "更新前メモ",
    };
    const updatedSession: WeekSessionDoc = {
      ...completedSession,
      reviewMemo: "更新後メモ",
      updatedAt: 9999,
    };

    const ctx = createMutationCtx(identity, {
      uniqueDoc: completedSession,
      getDocById: {
        "session-001": completedSession,
      },
      updatedDoc: updatedSession,
    });

    const result = await updateReviewMemoHandler(ctx, {
      weekStartDate: "2024-01-08",
      reviewMemo: "更新後メモ",
    });

    expect(result).toEqual(updatedSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "session-001",
      expect.objectContaining({
        reviewMemo: "更新後メモ",
        updatedAt: expect.any(Number),
      }),
    );
    expect(result.status).toBe("completed");
  });

  it("セッションが存在しない場合は ConvexError", async () => {
    const identity = createIdentity();
    const ctx = createMutationCtx(identity, {
      uniqueDoc: null,
    });

    await expect(
      updateReviewMemoHandler(ctx, {
        weekStartDate: "2024-01-08",
        reviewMemo: "メモ",
      }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      updateReviewMemoHandler(ctx, {
        weekStartDate: "2024-01-08",
        reviewMemo: "メモ",
      }),
    ).rejects.toMatchObject({ data: expect.any(String) });
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      updateReviewMemoHandler(ctx, { weekStartDate: "2024-01-08", reviewMemo: "メモ" }),
    ).rejects.toBeInstanceOf(ConvexError);

    await expect(
      updateReviewMemoHandler(ctx, { weekStartDate: "2024-01-08", reviewMemo: "メモ" }),
    ).rejects.toMatchObject({ data: "Not authenticated" });
  });
});

// ---------------------------------------------------------------------------
// completeWeekSession テスト
// ---------------------------------------------------------------------------

describe("completeWeekSession", () => {
  it("draft セッションを completed に変更できる", async () => {
    const identity = createIdentity();
    const completedSession: WeekSessionDoc = {
      ...sampleSession,
      status: "completed",
      reviewMemo: "今週のまとめ",
      updatedAt: 9999,
    };

    const ctx = createMutationCtx(identity, {
      uniqueDoc: sampleSession,
      getDocById: {
        "session-001": sampleSession,
      },
      updatedDoc: completedSession,
    });

    const result = await completeWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
      reviewMemo: "今週のまとめ",
    });

    expect(result).toEqual(completedSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "session-001",
      expect.objectContaining({
        status: "completed",
        reviewMemo: "今週のまとめ",
        updatedAt: expect.any(Number),
      }),
    );
  });

  it("セッションが存在しない場合は ConvexError", async () => {
    const identity = createIdentity();
    const ctx = createMutationCtx(identity, { uniqueDoc: null });

    await expect(
      completeWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);
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
// getOrCreateWeekSession テスト
// ---------------------------------------------------------------------------

describe("getOrCreateWeekSession", () => {
  it("指定週のセッションが存在しない場合は新規作成する", async () => {
    const identity = createIdentity();
    const createdSession: WeekSessionDoc = {
      ...sampleSession,
      _id: "new-session-id",
      weekStartDate: "2024-01-15",
      weekEndDate: "2024-01-21",
    };

    const ctx = createMutationCtx(identity, {
      uniqueDoc: null,
      insertedDoc: createdSession,
    });

    const result = await getOrCreateWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-15",
    });

    expect(result).toEqual(createdSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "weekSessions",
      expect.objectContaining({
        groupId: GROUP_ID,
        weekStartDate: "2024-01-15",
        status: "draft",
      }),
    );
  });

  it("指定週のセッションが存在する場合はそのまま返す", async () => {
    const identity = createIdentity();
    const ctx = createMutationCtx(identity, {
      uniqueDoc: sampleSession,
    });

    const result = await getOrCreateWeekSessionHandler(ctx, {
      weekStartDate: "2024-01-08",
    });

    expect(result).toEqual(sampleSession);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).not.toHaveBeenCalled();
  });

  it("未認証時: ConvexError が throw される", async () => {
    const ctx = createMutationCtx(null);

    await expect(
      getOrCreateWeekSessionHandler(ctx, { weekStartDate: "2024-01-08" }),
    ).rejects.toBeInstanceOf(ConvexError);
  });
});

describe("resetWeekSessionForUser", () => {
  it("status を draft に戻し、reviewMemo を削除する", async () => {
    const identity = createIdentity();
    const ctx = createMutationCtx(identity, {
      uniqueDoc: {
        ...sampleSession,
        status: "completed",
        reviewMemo: "今週のまとめ",
      },
    });

    await resetWeekSessionForUserHandler(ctx, {
      groupId: GROUP_ID as Id<"groups">,
      weekStartDate: "2024-01-08",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "session-001",
      expect.objectContaining({
        status: "draft",
        reviewMemo: undefined,
      }),
    );
  });
});
