import { describe, expect, it } from "vitest";
import { isTerminalImageJobStatus } from "./status";

describe("isTerminalImageJobStatus", () => {
  it.each([
    ["ready", true],
    ["needs_review", true],
    ["failed", true],
    ["cancelled", true],
    ["running", false],
    ["pending", false],
  ])("%s -> %s", (status, expected) => {
    expect(isTerminalImageJobStatus(status)).toBe(expected);
  });
});
