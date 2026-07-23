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
  it("確認画面は閉じる・修正する・保存して閉じるを表示する", () => {
    renderActions(true);

    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "修正する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存して閉じる" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "確認して準備OK" })).not.toBeInTheDocument();
  });

  it("編集画面は確認に戻る・保存して閉じるを表示する", async () => {
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
    expect(screen.getByRole("button", { name: "保存して閉じる" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存して閉じる" }));
    expect(onSubmit).toHaveBeenCalledWith(false);
  });
});
