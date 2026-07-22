import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { ReceiptImageConsentDialog } from "./ReceiptImageConsentDialog";

describe("ReceiptImageConsentDialog", () => {
  it("同意保存中のEscapeでは拒否処理を呼ばない", () => {
    const onDecline = vi.fn();
    renderWithProviders(
      <ReceiptImageConsentDialog open saving onAccept={vi.fn()} onDecline={onDecline} />,
    );

    fireEvent.keyDown(screen.getAllByRole("presentation")[0], {
      key: "Escape",
      code: "Escape",
    });

    expect(onDecline).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "読み取り中…" })).toBeDisabled();
  });
});
