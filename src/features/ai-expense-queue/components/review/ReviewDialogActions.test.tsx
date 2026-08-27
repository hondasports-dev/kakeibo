import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReviewDialogActions } from "./ReviewDialogActions";

function renderActions(showSummaryView: boolean) {
  return render(
    <ReviewDialogActions
      isSubmitDisabled={false}
      onClose={vi.fn()}
      onEnterEditMode={vi.fn()}
      onExitEditMode={vi.fn()}
      onSubmit={vi.fn()}
      reviewSubmitting={false}
      showSummaryView={showSummaryView}
    />,
  );
}

describe("ReviewDialogActions", () => {
  it("確認画面は2つの保存方法を明示する", () => {
    renderActions(true);

    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "修正する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で保存" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "レシート合計だけ保存" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認して準備OK" })).not.toBeInTheDocument();
  });

  it("編集画面から選んだ保存方法を送る", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ReviewDialogActions
        isSubmitDisabled={false}
        onClose={vi.fn()}
        onEnterEditMode={vi.fn()}
        onExitEditMode={vi.fn()}
        onSubmit={onSubmit}
        reviewSubmitting={false}
        showSummaryView={false}
      />,
    );

    expect(screen.getByRole("button", { name: "確認に戻る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "この内容で保存" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "この内容で保存" }));
    expect(onSubmit).toHaveBeenCalledWith(false);
    await user.click(screen.getByRole("button", { name: "レシート合計だけ保存" }));
    expect(onSubmit).toHaveBeenCalledWith(false, "totalOnly");
  });

  it("ユーザー補正がある場合だけ明示的にAI判定へ戻せる", async () => {
    const user = userEvent.setup();
    const onResetToAiInterpretation = vi.fn();
    render(
      <ReviewDialogActions
        canResetToAiInterpretation
        isSubmitDisabled={false}
        onClose={vi.fn()}
        onEnterEditMode={vi.fn()}
        onExitEditMode={vi.fn()}
        onResetToAiInterpretation={onResetToAiInterpretation}
        onSubmit={vi.fn()}
        reviewSubmitting={false}
        showSummaryView
      />,
    );

    await user.click(screen.getByRole("button", { name: "AI判定へ戻す" }));
    expect(onResetToAiInterpretation).toHaveBeenCalledOnce();
  });
});
