import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

export function SystemAdminPageFrame({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h2" variant="h4">
          {title}
        </Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {description}
          </Typography>
        ) : null}
      </Box>
      {children}
    </Stack>
  );
}

export function SystemAdminErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Alert
      action={onRetry ? <Button onClick={onRetry}>再試行</Button> : undefined}
      severity="error"
      variant="outlined"
    >
      管理情報を読み込めませんでした。時間をおいて再試行してください。
    </Alert>
  );
}

export function SystemAdminEmptyState({ message }: { message: string }) {
  return (
    <Paper sx={{ p: 4, textAlign: "center" }} variant="outlined">
      <Typography color="text.secondary">{message}</Typography>
    </Paper>
  );
}

export function SystemAdminBackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Button component={RouterLink} to={to} variant="text">
      {children}
    </Button>
  );
}
