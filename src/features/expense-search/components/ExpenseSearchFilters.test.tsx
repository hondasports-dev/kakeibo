import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../test/render";
import { EMPTY_EXPENSE_SEARCH_FORM } from "../lib/searchParams";
import { ExpenseSearchFilters } from "./ExpenseSearchFilters";

function StatefulFilters({ onClear, onSubmit }: { onClear: () => void; onSubmit: () => void }) {
  const [state, setState] = useState(EMPTY_EXPENSE_SEARCH_FORM);
  return (
    <ExpenseSearchFilters
      categories={[{ _id: "cat-food", name: "食費" }]}
      state={state}
      onChange={setState}
      onClear={() => {
        setState(EMPTY_EXPENSE_SEARCH_FORM);
        onClear();
      }}
      onSubmit={onSubmit}
    />
  );
}

describe("ExpenseSearchFilters", () => {
  it("条件を入力して絞り込む・クリアできる", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const onSubmit = vi.fn();

    renderWithProviders(<StatefulFilters onClear={onClear} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("店名"), "北浜");
    await user.click(screen.getByRole("button", { name: "絞り込む" }));
    expect(onSubmit).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "条件をクリア" }));
    expect(onClear).toHaveBeenCalled();
  });
});
