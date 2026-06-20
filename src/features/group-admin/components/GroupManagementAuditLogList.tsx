import { Box, Stack, Typography } from "@mui/material";
import { formatDateTimeForDisplay } from "../lib/datetimeFormat";
import {
  getManagementAuditLogDetailLabel,
  type GroupManagementAuditLogListItem,
} from "../utils/groupManagementAuditLogDisplay";

type GroupManagementAuditLogListProps = {
  logs: GroupManagementAuditLogListItem[];
};

export function GroupManagementAuditLogList({ logs }: GroupManagementAuditLogListProps) {
  if (logs.length === 0) {
    return (
      <Box
        data-testid="group-management-audit-log-list-empty"
        sx={{
          p: 1.5,
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary" variant="body2">
          管理操作の履歴はまだありません。
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="ul"
      className="group-management-audit-log-list"
      data-testid="group-management-audit-log-list"
      sx={{ m: 0, p: 0, listStyle: "none" }}
    >
      {logs.map((log) => (
        <Box
          className="group-management-audit-log-row"
          component="li"
          data-testid={`group-management-audit-log-${log._id}`}
          key={log._id}
          sx={{
            py: 1.25,
            borderBottom: "1px solid",
            borderColor: "divider",
            "&:last-child": { borderBottom: "none" },
          }}
        >
          <Stack spacing={0.5}>
            <Typography sx={{ fontWeight: 700 }} variant="body2">
              {log.actionLabel}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {getManagementAuditLogDetailLabel(log)}
            </Typography>
            <Typography color="text.secondary" variant="caption">
              {log.actorDisplayName} · {formatDateTimeForDisplay(log.createdAt)}
            </Typography>
          </Stack>
        </Box>
      ))}
    </Box>
  );
}
