import { describe, it, expect } from "vitest";
import {
  buildTransactionalEmail,
  validatePayloadForTemplate,
  getTemplateSubject,
} from "./templateFactory";

describe("templateFactory", () => {
  it("builds email_delivery_test email", async () => {
    const built = await buildTransactionalEmail("email_delivery_test", {
      to: "user@example.com",
      groupName: "family",
    });
    expect(built.subject).toBe("Suzumemo メール配信テスト");
    expect(built.html).toContain("user@example.com");
    expect(built.text).toContain("user@example.com");
  });

  it("validates payload", () => {
    const valid = validatePayloadForTemplate("email_delivery_test", { to: "user@example.com" });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data).toEqual({ to: "user@example.com" });
    }

    const invalid = validatePayloadForTemplate("email_delivery_test", { to: 123 });
    expect(invalid.success).toBe(false);
  });

  it("returns subject for known template", () => {
    expect(getTemplateSubject("email_delivery_test")).toBe("Suzumemo メール配信テスト");
  });
});
