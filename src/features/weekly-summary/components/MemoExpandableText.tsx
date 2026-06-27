import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Collapse, Stack, Typography } from "@mui/material";
import { useId, useState } from "react";

export const MEMO_PREVIEW_LENGTH = 40;

export function shouldCollapseMemo(memo: string): boolean {
  return memo.length > MEMO_PREVIEW_LENGTH;
}

export function getMemoPreviewText(memo: string): string {
  if (!shouldCollapseMemo(memo)) {
    return memo;
  }
  return `${memo.slice(0, MEMO_PREVIEW_LENGTH)}…`;
}

export function MemoExpandableText({ memo }: { memo: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const needsCollapse = shouldCollapseMemo(memo);
  const previewText = getMemoPreviewText(memo);

  if (!needsCollapse) {
    return (
      <Typography
        color="text.secondary"
        data-testid="memo-expandable-text"
        sx={{ mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
        variant="caption"
      >
        {memo}
      </Typography>
    );
  }

  return (
    <Stack data-testid="memo-expandable-text" spacing={0.25} sx={{ mt: 0.5, maxWidth: "100%" }}>
      {!expanded && (
        <Typography
          color="text.secondary"
          id={contentId}
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          variant="caption"
        >
          {previewText}
        </Typography>
      )}
      <Collapse in={expanded} unmountOnExit>
        <Typography
          color="text.secondary"
          id={contentId}
          sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          variant="caption"
        >
          {memo}
        </Typography>
      </Collapse>
      <Box>
        <Button
          aria-controls={contentId}
          aria-expanded={expanded}
          color="primary"
          data-testid="memo-expand-toggle"
          endIcon={
            expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />
          }
          onClick={() => setExpanded((current) => !current)}
          size="small"
          sx={{ minHeight: 28, minWidth: 0, px: 0, textTransform: "none" }}
          type="button"
          variant="text"
        >
          {expanded ? "閉じる" : "もっと見る"}
        </Button>
      </Box>
    </Stack>
  );
}
