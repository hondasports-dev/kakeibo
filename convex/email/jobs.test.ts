import { describe, it, expect, vi } from "vitest";
import type { MutationCtx } from "../_generated/server";
import { enqueueTransactionalEmailJobHandler } from "./jobs";

function createMutationCtx({ insertId = "job-123" }: { insertId?: string } = {}): MutationCtx {
  return {
    db: {
      insert: vi.fn().mockResolvedValue(insertId),
      query: vi.fn().mockReturnValue({
        withIndex: vi.fn().mockReturnValue({ unique: vi.fn().mockResolvedValue(null) }),
      }),
      get: vi.fn().mockResolvedValue(null),
      patch: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    auth: { getUserIdentity: vi.fn().mockResolvedValue(null) },
    scheduler: { runAfter: vi.fn().mockResolvedValue(undefined) },
    runQuery: vi.fn().mockResolvedValue(null),
    runMutation: vi.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MutationCtx;
}

describe("enqueueTransactionalEmailJobHandler", () => {
  it("queues an email job and schedules processing", async () => {
    const ctx = createMutationCtx();
    const payload = JSON.stringify({ to: "test@example.com", groupName: "Demo" });

    const jobId = await enqueueTransactionalEmailJobHandler(ctx, {
      templateType: "email_delivery_test",
      payloadJson: payload,
      recipientEmail: "Test@Example.com",
    });

    expect(jobId).toBe("job-123");
    const dbInsert = ctx.db.insert as ReturnType<typeof vi.fn>;
    expect(dbInsert).toHaveBeenCalledWith(
      "transactionalEmailJobs",
      expect.objectContaining({
        templateType: "email_delivery_test",
        recipientEmail: "Test@Example.com",
        normalizedRecipientEmail: "test@example.com",
        status: "queued",
        subject: "Suzumemo メール配信テスト",
        provider: "resend",
        attemptCount: 0,
        maxAttempts: 6,
      }),
    );

    const schedulerRunAfter = ctx.scheduler.runAfter as ReturnType<typeof vi.fn>;
    expect(schedulerRunAfter).toHaveBeenCalledWith(0, expect.anything(), { jobId: "job-123" });
  });

  it("throws ConvexError when payload JSON is invalid", async () => {
    const ctx = createMutationCtx();

    await expect(
      enqueueTransactionalEmailJobHandler(ctx, {
        templateType: "email_delivery_test",
        payloadJson: "not-json",
        recipientEmail: "test@example.com",
      }),
    ).rejects.toMatchObject({ data: "Invalid payload JSON" });
  });

  it("throws ConvexError when payload does not match schema", async () => {
    const ctx = createMutationCtx();

    await expect(
      enqueueTransactionalEmailJobHandler(ctx, {
        templateType: "email_delivery_test",
        payloadJson: JSON.stringify({ missingTo: true }),
        recipientEmail: "test@example.com",
      }),
    ).rejects.toMatchObject({ data: "Invalid transactional email payload" });
  });
});
