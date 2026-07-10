import { describe, it, expect, vi } from "vitest";
import type { MutationCtx } from "../_generated/server";
import { upsertSuppressionHandler } from "./suppressions";

function createMutationCtx(existing: Record<string, unknown> | null = null): MutationCtx {
  const queryWithIndex = vi
    .fn()
    .mockImplementation(
      (
        _indexName: string,
        builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown,
      ) => {
        const q = {
          eq: vi.fn().mockImplementation((_field: string, _value: unknown) => q),
        };
        builder(q);
        return {
          unique: vi.fn().mockResolvedValue(existing),
        };
      },
    );

  return {
    db: {
      insert: vi.fn().mockResolvedValue("new-suppression-id"),
      patch: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockReturnValue({ withIndex: queryWithIndex }),
      get: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    auth: { getUserIdentity: vi.fn().mockResolvedValue(null) },
    runQuery: vi.fn().mockResolvedValue(null),
    runMutation: vi.fn().mockResolvedValue(undefined),
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

describe("upsertSuppressionHandler", () => {
  it("inserts a new suppression when none exists", async () => {
    const ctx = createMutationCtx(null);

    const id = await upsertSuppressionHandler(ctx, {
      email: "Test@Example.com",
      normalizedEmail: "test@example.com",
      reason: "bounce",
      source: "hard_bounce",
      providerMessageId: "msg-1",
      createdAt: 1000,
    });

    expect(id).toBe("new-suppression-id");
    const dbInsert = ctx.db.insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "emailSuppressions",
      expect.objectContaining({
        email: "Test@Example.com",
        normalizedEmail: "test@example.com",
        reason: "bounce",
        source: "hard_bounce",
        providerMessageId: "msg-1",
        createdAt: 1000,
        updatedAt: 1000,
      }),
    );
  });

  it("patches an existing suppression", async () => {
    const existing = { _id: "sup-1" };
    const ctx = createMutationCtx(existing as Record<string, unknown>);

    const id = await upsertSuppressionHandler(ctx, {
      email: "test@example.com",
      normalizedEmail: "test@example.com",
      reason: "complaint",
      source: "abuse",
      providerMessageId: "msg-2",
      createdAt: 2000,
    });

    expect(id).toBe("sup-1");
    const dbPatch = ctx.db.patch as ReturnType<typeof vi.fn>;
    expect(dbPatch).toHaveBeenCalledWith(
      "sup-1",
      expect.objectContaining({
        reason: "complaint",
        source: "abuse",
        providerMessageId: "msg-2",
        updatedAt: 2000,
      }),
    );
  });
});
