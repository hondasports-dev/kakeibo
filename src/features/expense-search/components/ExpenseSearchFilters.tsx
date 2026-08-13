import { Button, MenuItem, Stack, TextField } from "@mui/material";
import type { ExpenseSearchFormState } from "../lib/searchParams";

type CategoryOption = {
  _id: string;
  name: string;
};

export function ExpenseSearchFilters({
  categories,
  state,
  onChange,
  onClear,
  onSubmit,
}: {
  categories: CategoryOption[];
  state: ExpenseSearchFormState;
  onChange: (state: ExpenseSearchFormState) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  const hasFilter = Object.values(state).some((value) => value.length > 0);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            fullWidth
            label="店名"
            name="shopQuery"
            placeholder="店名・商品名"
            value={state.shopQuery}
            onChange={(event) => onChange({ ...state, shopQuery: event.target.value })}
          />
          <TextField
            fullWidth
            select
            label="カテゴリ"
            name="categoryId"
            value={state.categoryId}
            onChange={(event) => onChange({ ...state, categoryId: event.target.value })}
          >
            <MenuItem value="">指定なし</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category._id} value={category._id}>
                {category.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            fullWidth
            label="金額の下限"
            name="minAmountYen"
            slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
            value={state.minAmountYen}
            onChange={(event) => onChange({ ...state, minAmountYen: event.target.value })}
          />
          <TextField
            fullWidth
            label="金額の上限"
            slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }}
            name="maxAmountYen"
            value={state.maxAmountYen}
            onChange={(event) => onChange({ ...state, maxAmountYen: event.target.value })}
          />
          <TextField
            fullWidth
            label="開始日"
            name="startDate"
            slotProps={{ inputLabel: { shrink: true } }}
            type="date"
            value={state.startDate}
            onChange={(event) => onChange({ ...state, startDate: event.target.value })}
          />
          <TextField
            fullWidth
            label="終了日"
            name="endDate"
            slotProps={{ inputLabel: { shrink: true } }}
            type="date"
            value={state.endDate}
            onChange={(event) => onChange({ ...state, endDate: event.target.value })}
          />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained">
            絞り込む
          </Button>
          {hasFilter ? (
            <Button onClick={onClear} type="button">
              条件をクリア
            </Button>
          ) : null}
        </Stack>
      </Stack>
    </form>
  );
}
