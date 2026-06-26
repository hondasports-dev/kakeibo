import HelpIcon from "@mui/icons-material/Help";
import { Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { useId, useState, type ReactNode } from "react";

export function CollapsibleHelp({
  summary,
  children,
  defaultExpanded = false,
}: {
  summary: string;
  children: ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const contentId = useId();

  return (
    <Box>
      <Button
        aria-controls={contentId}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        size="small"
        startIcon={<HelpIcon fontSize="small" />}
        sx={{ alignSelf: "flex-start", px: 0 }}
        type="button"
        variant="text"
      >
        {summary}
      </Button>
      <Collapse id={contentId} in={expanded}>
        <Stack spacing={0.5} sx={{ pt: 0.5 }}>
          {typeof children === "string" ? (
            <Typography color="text.secondary" variant="body2">
              {children}
            </Typography>
          ) : (
            children
          )}
        </Stack>
      </Collapse>
    </Box>
  );
}
