import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

type GroupSettingsSectionProps = {
  children: ReactNode;
  description?: string;
  testId?: string;
  title: string;
};

export function GroupSettingsSection({
  children,
  description,
  testId,
  title,
}: GroupSettingsSectionProps) {
  const headingId = testId ? `${testId}-heading` : undefined;

  return (
    <Box aria-labelledby={headingId} component="section" data-testid={testId}>
      <Stack spacing={1.5}>
        <Box>
          <Typography component="h3" id={headingId} variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {description ? (
            <Typography color="text.secondary" variant="body2">
              {description}
            </Typography>
          ) : null}
        </Box>
        {children}
      </Stack>
    </Box>
  );
}
