import type { UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "./_generated/server";
import {
  getAuthStateFromIdentity,
  requireAuthenticatedUserId,
  upsertUserHandler,
} from "./users";

type AuthContext = Parameters<typeof requireAuthenticatedUserId>[0];

function createIdentity(overrides: Partial<UserIdentity> = {}): UserIdentity {
  return {
    tokenIdentifier: "https://issuer.example|clerk-user-token",
    subject: "clerk-user-subject",
    issuer: "https://issuer.example",
    ...overrides,
  };
}

function createAuthContext(identity: UserIdentity | null): AuthContext {
  return {
    auth: {
      getUserIdentity: vi
        .fn<() => Promise<UserIdentity | null>>()
        .mockResolvedValue(identity),
    },
  };
}

describe("requireAuthenticatedUserId", () => {
  it("throws ConvexError when the request is unauthenticated", async () => {
    await expect(
      requireAuthenticatedUserId(createAuthContext(null)),
    ).rejects.toMatchObject({
      data: "Not authenticated",
    });

    await expect(
      requireAuthenticatedUserId(createAuthContext(null)),
    ).rejects.toBeInstanceOf(ConvexError);
  });

  it("returns identity.tokenIdentifier for an authenticated request", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user_123",
    });

    await expect(
      requireAuthenticatedUserId(createAuthContext(identity)),
    ).resolves.toBe("https://issuer.example|user_123");
  });

  it("does not use subject when tokenIdentifier is present", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|canonical-user-id",
      subject: "subject-only-user-id",
    });

    await expect(
      requireAuthenticatedUserId(createAuthContext(identity)),
    ).resolves.toBe("https://issuer.example|canonical-user-id");
  });
});

describe("getAuthStateFromIdentity", () => {
  it("returns an unauthenticated state when identity is null", () => {
    expect(getAuthStateFromIdentity(null)).toEqual({
      isAuthenticated: false,
      userId: null,
    });
  });

  it("returns an authenticated state with identity.tokenIdentifier", () => {
    expect(
      getAuthStateFromIdentity(
        createIdentity({
          tokenIdentifier: "https://issuer.example|user_456",
          subject: "subject-only-user-id",
        }),
      ),
    ).toEqual({
      isAuthenticated: true,
      userId: "https://issuer.example|user_456",
    });
  });
});

// ---------------------------------------------------------------------------
// upsertUser テスト用ヘルパー
// ---------------------------------------------------------------------------

type Doc = {
  _id: string;
  _creationTime: number;
  userId: string;
  displayName: string;
  email?: string;
  createdAt: number;
  updatedAt: number;
};

/**
 * upsertUserHandler が必要とする MutationCtx の最小モックを生成する。
 * existingDoc が null のとき初回ログイン（insert）、Doc のとき2回目以降（patch）を再現する。
 */
function createMutationCtx(
  identity: UserIdentity | null,
  existingDoc: Doc | null = null,
): MutationCtx {
  const insertMock = vi.fn().mockResolvedValue("new-doc-id");
  const patchMock = vi.fn().mockResolvedValue(undefined);

  const uniqueMock = vi.fn().mockResolvedValue(existingDoc);
  const withIndexMock = vi.fn().mockReturnValue({ unique: uniqueMock });
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
      patch: patchMock,
      // 以下は今回のハンドラーでは未使用だがMutationCtx型を満たすためにキャスト
    },
    // TODO: MutationCtx の完全な型を満たす型安全なモックファクトリーへの置き換えを検討する
    //       現状は as any as MutationCtx で型チェックをバイパスしているため、
    //       将来的には convex-test などのテストユーティリティの活用を検討してください。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

// ---------------------------------------------------------------------------
// upsertUser テスト
// ---------------------------------------------------------------------------

describe("upsertUser", () => {
  it("未認証時は ConvexError を throw する", async () => {
    const ctx = createMutationCtx(null);

    await expect(upsertUserHandler(ctx)).rejects.toBeInstanceOf(ConvexError);
    await expect(upsertUserHandler(ctx)).rejects.toMatchObject({
      data: "Not authenticated",
    });
  });

  it("初回ログイン時は users テーブルに新規ドキュメントを作成する", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|clerk-user-token",
      name: "テストユーザー",
      email: "test@example.com",
    });
    // existingDoc = null → insert が呼ばれるケース
    const ctx = createMutationCtx(identity, null);

    await upsertUserHandler(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledOnce();
    expect(dbInsert).toHaveBeenCalledWith("users", {
      userId: "https://issuer.example|clerk-user-token",
      displayName: "テストユーザー",
      email: "test@example.com",
      createdAt: expect.any(Number),
      updatedAt: expect.any(Number),
    });

    // patch は呼ばれていないこと
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).not.toHaveBeenCalled();
  });

  it("2回目以降のログイン時は既存ドキュメントを更新する（重複しない）", async () => {
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|clerk-user-token",
      name: "更新後の名前",
      email: "updated@example.com",
    });
    const existingDoc: Doc = {
      _id: "existing-doc-id",
      _creationTime: 1000000,
      userId: "https://issuer.example|clerk-user-token",
      displayName: "旧名前",
      email: "old@example.com",
      createdAt: 1000000,
      updatedAt: 1000000,
    };
    // existingDoc あり → patch が呼ばれるケース
    const ctx = createMutationCtx(identity, existingDoc);

    await upsertUserHandler(ctx);

    // insert は呼ばれていないこと（重複なし）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).not.toHaveBeenCalled();

    // patch が既存ドキュメントの _id で呼ばれること
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbPatch = (ctx.db as any).patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledOnce();
    expect(dbPatch).toHaveBeenCalledWith("existing-doc-id", {
      displayName: "更新後の名前",
      email: "updated@example.com",
      updatedAt: expect.any(Number),
    });
  });

  it("userId には tokenIdentifier を使い、Clerk の user_xxx 形式は使わない", async () => {
    // Clerk の subject は "user_xxx" 形式だが、tokenIdentifier を使うことを検証する
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|clerk-canonical-id",
      subject: "user_clerk_raw_id", // Clerk の生 user_xxx 形式
      email: "canonical@example.com",
    });
    const ctx = createMutationCtx(identity, null);

    await upsertUserHandler(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    const insertedDoc = dbInsert.mock.calls[0][1] as { userId: string };

    // userId は tokenIdentifier であること
    expect(insertedDoc.userId).toBe(
      "https://issuer.example|clerk-canonical-id",
    );
    // Clerk の生 user_xxx 形式の subject は使われていないこと
    expect(insertedDoc.userId).not.toBe("user_clerk_raw_id");
  });

  it("name が undefined/null の場合は email を displayName に使う", async () => {
    // name なし・email あり → email が displayName になる
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-no-name",
      name: undefined,
      email: "fallback@example.com",
    });
    const ctx = createMutationCtx(identity, null);

    await upsertUserHandler(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    const insertedDoc = dbInsert.mock.calls[0][1] as {
      displayName: string;
      email?: string;
    };

    expect(insertedDoc.displayName).toBe("fallback@example.com");
    expect(insertedDoc.email).toBe("fallback@example.com");
  });

  it("name も email も null/undefined の場合は 'ユーザー' を displayName に使う", async () => {
    // name も email もなし → "ユーザー" が displayName になる
    const identity = createIdentity({
      tokenIdentifier: "https://issuer.example|user-no-name-no-email",
      name: undefined,
      email: undefined,
    });
    const ctx = createMutationCtx(identity, null);

    await upsertUserHandler(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbInsert = (ctx.db as any).insert as ReturnType<typeof vi.fn>;
    const insertedDoc = dbInsert.mock.calls[0][1] as {
      displayName: string;
      email?: string;
    };

    expect(insertedDoc.displayName).toBe("ユーザー");
    expect(insertedDoc.email).toBeUndefined();
  });
});
