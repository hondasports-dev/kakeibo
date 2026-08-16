import { describe, expect, it } from "vitest";

import {
  decideLineIntegrationMode,
  ensureLineIntegrationMode,
  parseConvexEnvGetResult,
} from "./ensure-line-integration-mode.mjs";

describe("parseConvexEnvGetResult", () => {
  it("keeps mock and real values", () => {
    expect(parseConvexEnvGetResult({ status: 0, stdout: "real\n", stderr: "" })).toEqual({
      kind: "found",
      value: "real",
    });
    expect(parseConvexEnvGetResult({ status: 0, stdout: "mock", stderr: "" })).toEqual({
      kind: "found",
      value: "mock",
    });
  });

  it("treats Convex not-found as missing when env get exits 0", () => {
    expect(
      parseConvexEnvGetResult({
        status: 0,
        stdout: "",
        stderr: 'Environment variable "LINE_INTEGRATION_MODE" not found',
      }),
    ).toEqual({ kind: "missing" });
  });

  it("treats nonzero env get as error even if stderr says not found", () => {
    expect(
      parseConvexEnvGetResult({
        status: 1,
        stdout: "",
        stderr: "deployment not found",
      }),
    ).toEqual({ kind: "error" });
  });

  it("treats empty or invalid values as needing a default", () => {
    expect(parseConvexEnvGetResult({ status: 0, stdout: "", stderr: "" })).toEqual({
      kind: "missing",
    });
    expect(parseConvexEnvGetResult({ status: 0, stdout: "prod\n", stderr: "" })).toEqual({
      kind: "invalid",
    });
  });

  it("does not treat auth failures as missing", () => {
    expect(
      parseConvexEnvGetResult({
        status: 1,
        stdout: "",
        stderr: "You are not logged in",
      }),
    ).toEqual({ kind: "error" });
  });
});

describe("decideLineIntegrationMode", () => {
  it("preserves existing mock and real", () => {
    expect(decideLineIntegrationMode({ kind: "found", value: "real" })).toEqual({
      action: "keep",
      mode: "real",
    });
    expect(decideLineIntegrationMode({ kind: "found", value: "mock" })).toEqual({
      action: "keep",
      mode: "mock",
    });
  });

  it("sets mock when unset or invalid", () => {
    expect(decideLineIntegrationMode({ kind: "missing" })).toEqual({
      action: "set",
      mode: "mock",
    });
    expect(decideLineIntegrationMode({ kind: "invalid" })).toEqual({
      action: "set",
      mode: "mock",
    });
  });

  it("aborts when Convex cannot be read", () => {
    expect(decideLineIntegrationMode({ kind: "error" })).toEqual({ action: "abort" });
  });
});

describe("ensureLineIntegrationMode", () => {
  it("does not overwrite an existing real value", () => {
    const calls = [];
    const logs = [];
    const result = ensureLineIntegrationMode({
      runConvexEnv: (args) => {
        calls.push(args);
        return { status: 0, stdout: "real\n", stderr: "" };
      },
      log: (message) => logs.push(message),
    });

    expect(result).toEqual({ action: "keep", mode: "real" });
    expect(calls).toEqual([["env", "get", "LINE_INTEGRATION_MODE"]]);
    expect(logs).toEqual(["LINE_INTEGRATION_MODE already set to real; leaving unchanged."]);
  });

  it("sets mock only when the variable is missing", () => {
    const calls = [];
    const result = ensureLineIntegrationMode({
      runConvexEnv: (args) => {
        calls.push(args);
        if (args[1] === "get") {
          return {
            status: 0,
            stdout: "",
            stderr: 'Environment variable "LINE_INTEGRATION_MODE" not found',
          };
        }
        return { status: 0, stdout: "", stderr: "" };
      },
      log: () => {},
    });

    expect(result).toEqual({ action: "set", mode: "mock" });
    expect(calls).toEqual([
      ["env", "get", "LINE_INTEGRATION_MODE"],
      ["env", "set", "LINE_INTEGRATION_MODE", "mock"],
    ]);
  });

  it("fails closed when Convex env get errors", () => {
    expect(() =>
      ensureLineIntegrationMode({
        runConvexEnv: () => ({ status: 1, stdout: "", stderr: "You are not logged in" }),
        log: () => {},
      }),
    ).toThrow("Failed to read LINE_INTEGRATION_MODE from Convex.");
  });

  it("does not set mock when Convex reports deployment not found", () => {
    const calls = [];

    expect(() =>
      ensureLineIntegrationMode({
        runConvexEnv: (args) => {
          calls.push(args);
          return { status: 1, stdout: "", stderr: "deployment not found" };
        },
        log: () => {},
      }),
    ).toThrow("Failed to read LINE_INTEGRATION_MODE from Convex.");

    expect(calls).toEqual([["env", "get", "LINE_INTEGRATION_MODE"]]);
  });
});
