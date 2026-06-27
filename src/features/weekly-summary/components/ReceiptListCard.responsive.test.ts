import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ReceiptListCard responsive styles", () => {
  const css = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");

  it("PC一覧では日付と金額を詰めて店名・内容の幅を広げる", () => {
    expect(css).toMatch(
      /grid-template-columns:\s*88px minmax\(156px, 1\.3fr\) minmax\(100px, 0\.8fr\) 104px/,
    );
  });
});
