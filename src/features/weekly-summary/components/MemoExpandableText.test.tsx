import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../../test/render";
import {
  getMemoPreviewText,
  MemoExpandableText,
  MEMO_PREVIEW_LENGTH,
  shouldCollapseMemo,
} from "./MemoExpandableText";

describe("MemoExpandableText helpers", () => {
  it("40文字以下は折りたたみ不要", () => {
    const memo = "あ".repeat(MEMO_PREVIEW_LENGTH);
    expect(shouldCollapseMemo(memo)).toBe(false);
    expect(getMemoPreviewText(memo)).toBe(memo);
  });

  it("41文字以上はプレビュー末尾に省略記号を付ける", () => {
    const memo = "あ".repeat(MEMO_PREVIEW_LENGTH + 1);
    expect(shouldCollapseMemo(memo)).toBe(true);
    expect(getMemoPreviewText(memo)).toBe(`${"あ".repeat(MEMO_PREVIEW_LENGTH)}…`);
  });
});

describe("MemoExpandableText", () => {
  it("短いメモは全文を表示しトグルを出さない", () => {
    renderWithProviders(<MemoExpandableText memo="夕食の買い物" />);

    expect(screen.getByTestId("memo-expandable-text")).toHaveTextContent("夕食の買い物");
    expect(screen.queryByTestId("memo-expand-toggle")).not.toBeInTheDocument();
  });

  it("長いメモは省略表示し、展開と折りたたみを切り替える", async () => {
    const user = userEvent.setup();
    const longMemo = "メモ確認用の長文テスト。".repeat(4);

    renderWithProviders(<MemoExpandableText memo={longMemo} />);

    expect(screen.getByText(getMemoPreviewText(longMemo))).toBeVisible();
    expect(screen.queryByText(longMemo)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "もっと見る" }));
    expect(screen.getByText(longMemo)).toBeVisible();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    await waitFor(() => {
      expect(screen.getByText(getMemoPreviewText(longMemo))).toBeVisible();
      expect(screen.queryByText(longMemo)).not.toBeInTheDocument();
    });
  });
});
