import { Button, MenuItem, Stack, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";
import type { ExpenseSearchFormState } from "../lib/searchParams";

type CategoryOption = {
  _id: string;
  name: string;
};

const pickerPaperSx = {
  "& .MuiPaper-root": {
    border: "1px solid",
    borderColor: "divider",
  },
} as const;

function digitsOnly(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function dateFromIso(value: string): Dayjs | null {
  if (!value) {
    return null;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function isoFromDate(value: Dayjs | null): string {
  return value?.isValid() ? value.format("YYYY-MM-DD") : "";
}

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
            slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
            value={state.minAmountYen}
            onChange={(event) =>
              onChange({ ...state, minAmountYen: digitsOnly(event.target.value) })
            }
          />
          <TextField
            fullWidth
            label="金額の上限"
            name="maxAmountYen"
            slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
            value={state.maxAmountYen}
            onChange={(event) =>
              onChange({ ...state, maxAmountYen: digitsOnly(event.target.value) })
            }
          />
          <DatePicker
            format="YYYY/MM/DD"
            label="開始日"
            name="startDate"
            onChange={(value) => onChange({ ...state, startDate: isoFromDate(value) })}
            slotProps={{
              field: { clearable: true },
              openPickerButton: { "aria-label": "開始日を選択" },
              popper: { sx: pickerPaperSx },
              textField: {
                fullWidth: true,
                sx: { "& .MuiInputBase-root": { backgroundColor: "background.paper" } },
              },
            }}
            value={dateFromIso(state.startDate)}
          />
          <DatePicker
            format="YYYY/MM/DD"
            label="終了日"
            name="endDate"
            onChange={(value) => onChange({ ...state, endDate: isoFromDate(value) })}
            slotProps={{
              field: { clearable: true },
              openPickerButton: { "aria-label": "終了日を選択" },
              popper: { sx: pickerPaperSx },
              textField: {
                fullWidth: true,
                sx: { "& .MuiInputBase-root": { backgroundColor: "background.paper" } },
              },
            }}
            value={dateFromIso(state.endDate)}
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
