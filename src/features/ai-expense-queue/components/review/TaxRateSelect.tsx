import { MenuItem, TextField } from "@mui/material";

export function TaxRateSelect({
  value,
  label = "税率",
  disabled,
  onChange,
}: {
  value: 0 | 8 | 10 | null | undefined;
  label?: string;
  disabled?: boolean;
  onChange: (value: 0 | 8 | 10 | null) => void;
}) {
  const selectValue = value === 0 || value === 8 || value === 10 ? String(value) : "unset";

  return (
    <TextField
      aria-label={label}
      disabled={disabled}
      label={label}
      onChange={(event) => {
        const next = event.target.value;
        if (next === "unset") {
          onChange(null);
          return;
        }
        onChange(Number(next) as 0 | 8 | 10);
      }}
      select
      size="small"
      value={selectValue}
    >
      <MenuItem value="8">8%</MenuItem>
      <MenuItem value="10">10%</MenuItem>
      <MenuItem value="0">0%</MenuItem>
      <MenuItem value="unset">未設定</MenuItem>
    </TextField>
  );
}
