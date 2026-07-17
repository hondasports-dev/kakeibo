// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { convexTestModules } from "../test.setup";

const OWNER_USER_ID = "https://clerk.example.test|owner";

async function seedOwnedGroup(t: ReturnType<typeof convexTest>, name = "佐藤家") {
  return await t.run(async (ctx) => {
    const groupId = await ctx.db.insert("groups", {
      name,
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("users", {
      userId: OWNER_USER_ID,
      displayName: "オーナー",
      email: "owner@example.test",
      activeGroupId: groupId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("groupMembers", {
      groupId,
      userId: OWNER_USER_ID,
      role: "owner",
      createdAt: 1,
      updatedAt: 1,
    });
    return groupId;
  });
}

function asOwner(t: ReturnType<typeof convexTest>) {
  return t.withIdentity({ tokenIdentifier: OWNER_USER_ID, subject: "owner" });
}

describe("owner group deletion public API", () => {
  it("bounded previewは100件を超える件数をat_least、派生画像件数をunknownで返す", async () => {
    const t = convexTest(schema, convexTestModules);
    const groupId = await seedOwnedGroup(t);
    await t.run(async (ctx) => {
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("sourceDocuments", {
          groupId,
          sourceType: "receipt",
          status: "ready",
          createdAt: index + 2,
          updatedAt: index + 2,
        });
      }
    });

    const preview = await asOwner(t).query(api.groups.deletion.getGroupDeletionPreview, {});

    expect(preview.sourceDocuments).toEqual({ count: 100, accuracy: "at_least" });
    expect(preview.receiptImages).toEqual({ count: 0, accuracy: "unknown" });
    expect(preview.members).toEqual({ count: 1, accuracy: "exact" });
  });

  it("削除開始はjob作成・deleting遷移・requesterのactive group解除を原子的に行う", async () => {
    const t = convexTest(schema, convexTestModules);
    const groupId = await seedOwnedGroup(t);

    const jobId = await asOwner(t).mutation(api.groups.deletion.requestGroupDeletion, {
      confirmationGroupName: "  佐藤家  ",
    });

    const state = await t.run(async (ctx) => ({
      group: await ctx.db.get(groupId),
      job: await ctx.db.get(jobId),
      user: await ctx.db
        .query("users")
        .withIndex("by_token_identifier", (q) => q.eq("userId", OWNER_USER_ID))
        .unique(),
    }));
    expect(state.group?.status).toBe("deleting");
    expect(state.job).toMatchObject({
      actorUserIdSnapshot: OWNER_USER_ID,
      source: "owner",
      status: "requested",
      isActive: true,
    });
    expect(state.user?.activeGroupId).toBeUndefined();
  });
});
