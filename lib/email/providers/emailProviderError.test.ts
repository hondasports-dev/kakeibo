import { describe, it, expect } from "vitest";
import { classifyResendApiError } from "./emailProviderError";

describe("classifyResendApiError", () => {
  it("classifies 429 as rate_limited and retryable", () => {
    const error = classifyResendApiError({ statusCode: 429, message: "Rate limited" });
    expect(error.code).toBe("rate_limited");
    expect(error.retryable).toBe(true);
  });

  it("classifies 400/422 as invalid_request and non-retryable", () => {
    const e400 = classifyResendApiError({ statusCode: 400, message: "Bad request" });
    expect(e400.code).toBe("invalid_request");
    expect(e400.retryable).toBe(false);

    const e422 = classifyResendApiError({ statusCode: 422, message: "Invalid" });
    expect(e422.code).toBe("invalid_request");
    expect(e422.retryable).toBe(false);
  });

  it("classifies 500 as server_error and retryable", () => {
    const error = classifyResendApiError({ statusCode: 503, message: "Unavailable" });
    expect(error.code).toBe("server_error");
    expect(error.retryable).toBe(true);
  });

  it("classifies suppressed code as non-retryable", () => {
    const error = classifyResendApiError({
      statusCode: 422,
      message: "Suppressed",
      error: { code: "suppressed" },
    });
    expect(error.code).toBe("suppressed");
    expect(error.retryable).toBe(false);
  });

  it("classifies 401/403 as configuration_error and non-retryable", () => {
    const e401 = classifyResendApiError({ statusCode: 401, message: "Unauthorized" });
    expect(e401.code).toBe("configuration_error");
    expect(e401.retryable).toBe(false);

    const e403 = classifyResendApiError({ statusCode: 403, message: "Forbidden" });
    expect(e403.code).toBe("configuration_error");
    expect(e403.retryable).toBe(false);
  });

  it("classifies timeout messages as retryable", () => {
    const error = classifyResendApiError({ message: "connection timeout" });
    expect(error.code).toBe("timeout");
    expect(error.retryable).toBe(true);
  });

  it("classifies unknown errors as retryable by default", () => {
    const error = classifyResendApiError({ message: "Something else" });
    expect(error.code).toBe("unknown");
    expect(error.retryable).toBe(true);
  });
});
