import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
} from "@mui/material";
import type { SystemAdminAuditAction } from "../types";
import { actionOptions } from "../hooks/useSystemAdminAuditLog";

type AuditLogFiltersProps = {
  action: SystemAdminAuditAction | "";
  actor: string;
  target: string;
  fromDate: string;
  toDate: string;
  hasFilter: boolean;
  onActionChange: (action: SystemAdminAuditAction | "") => void;
  onActorChange: (actor: string) => void;
  onTargetChange: (target: string) => void;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onClear: () => void;
};

export function AuditLogFilters({
  action,
  actor,
  target,
  fromDate,
  toDate,
  hasFilter,
  onActionChange,
  onActorChange,
  onTargetChange,
  onFromDateChange,
  onToDateChange,
  onClear,
}: AuditLogFiltersProps) {
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <TextField
          slotProps={{ inputLabel: { shrink: true } }}
          label="開始日"
          onChange={(event) => onFromDateChange(event.target.value)}
          type="date"
          value={fromDate}
        />
        <TextField
          slotProps={{ inputLabel: { shrink: true } }}
          label="終了日"
          onChange={(event) => onToDateChange(event.target.value)}
          type="date"
          value={toDate}
        />
        <FormControl sx={{ minWidth: 180 }}>
          <InputLabel id="system-admin-audit-action-label">操作</InputLabel>
          <Select
            label="操作"
            labelId="system-admin-audit-action-label"
            value={action}
            onChange={(event) => onActionChange(event.target.value as SystemAdminAuditAction | "")}
          >
            {actionOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="actor userId"
          onChange={(event) => onActorChange(event.target.value)}
          value={actor}
        />
        <TextField
          label="target userId"
          onChange={(event) => onTargetChange(event.target.value)}
          value={target}
        />
        {hasFilter ? <Button onClick={onClear}>条件をクリア</Button> : null}
      </Stack>
    </Paper>
  );
}
