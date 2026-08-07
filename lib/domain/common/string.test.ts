import { describe, expect, it } from "vitest";
import { trimOptional } from "./string";

describe("trimOptional", () => {
  it("前後空白を取り除く", () => {
    expect(trimOptional("  hello  ")).toBe("hello");
  });

  it("undefined は undefined のまま", () => {
    expect(trimOptional(undefined)).toBeUndefined();
  });

  it.each(["", "   ", "\t\n"])("空白のみの文字列は undefined に正規化する", (value) => {
    expect(trimOptional(value)).toBeUndefined();
  });
});
