/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("system admin schema", () => {
  it("system admin と専用監査ログを保存できる", async () => {
    expect(schema.tables).toHaveProperty("systemAdmins");
    expect(schema.tables).toHaveProperty("systemAdminAuditLogs");

    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        userId: "https://issuer.example|admin",
        displayName: "管理者",
        email: "admin@example.com",
        createdAt: 1,
        updatedAt: 1,
      });
    });

    await t.run(async (ctx) => {
      const db = ctx.db as unknown as {
        insert(table: string, value: Record<string, unknown>): Promise<string>;
      };
      await db.insert("systemAdmins", {
        userId,
        status: "active",
        createdAt: 2,
        updatedAt: 2,
        grantedAt: 2,
        grantReason: "初期管理者",
      });
      await db.insert("systemAdminAuditLogs", {
        action: "system_admin_bootstrapped",
        actorType: "system",
        targetKind: "system_admin",
        targetUserId: userId,
        reason: "初期管理者",
        newStatus: "active",
        createdAt: 2,
      });
    });

    const result = await t.run(async (ctx) => {
      const db = ctx.db as unknown as {
        query(table: string): { collect(): Promise<Array<Record<string, unknown>>> };
      };
      return {
        admins: await db.query("systemAdmins").collect(),
        auditLogs: await db.query("systemAdminAuditLogs").collect(),
      };
    });

    expect(result.admins).toHaveLength(1);
    expect(result.auditLogs).toHaveLength(1);
  });
});
