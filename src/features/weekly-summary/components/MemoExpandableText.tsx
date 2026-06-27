import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  getMemoLineClampSx,
  MEMO_COLLAPSED_MAX_LINES,
  memoNeedsCollapseByLayout,
  memoNeedsCollapseByLineCount,
} from "../utils/memoExpandableTextUtils";

const memoTypographySx = {
  whiteSpace: "pre-wrap" as const,
  wordBreak: "break-word" as const,
};

export function MemoExpandableText({ memo }: { memo: string }) {
  const needsCollapseByLines = memoNeedsCollapseByLineCount(memo);
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(needsCollapseByLines);
  const measureRef = useRef<HTMLSpanElement>(null);
  const contentId = useId();

  useEffect(() => {
    setExpanded(false);
    setNeedsCollapse(memoNeedsCollapseByLineCount(memo));
  }, [memo]);

  useLayoutEffect(() => {
    if (needsCollapseByLines) {
      return;
    }

    const measureElement = measureRef.current;
    if (!measureElement) {
      return;
    }

    const updateNeedsCollapse = () => {
      const lineHeight = parseFloat(getComputedStyle(measureElement).lineHeight);
      setNeedsCollapse(memoNeedsCollapseByLayout(measureElement.scrollHeight, lineHeight));
    };

    updateNeedsCollapse();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(updateNeedsCollapse);
    resizeObserver.observe(measureElement);

    return () => {
      resizeObserver.disconnect();
    };
  }, [memo, needsCollapseByLines]);

  const visibleTypography = (
    <Typography
      color="text.secondary"
      data-testid="memo-expandable-content"
      id={contentId}
      sx={{
        ...memoTypographySx,
        ...(needsCollapse && !expanded ? getMemoLineClampSx(MEMO_COLLAPSED_MAX_LINES) : {}),
      }}
      variant="caption"
    >
      {memo}
    </Typography>
  );

  if (!needsCollapse) {
    return (
      <Stack
        data-testid="memo-expandable-text"
        spacing={0.25}
        sx={{ mt: 0.5, maxWidth: "100%", position: "relative" }}
      >
        {!needsCollapseByLines && (
          <Typography
            ref={measureRef}
            aria-hidden
            color="text.secondary"
            component="span"
            data-testid="memo-expand-measure"
            sx={{
              ...memoTypographySx,
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
              width: "100%",
              inset: 0,
              height: "auto",
            }}
            variant="caption"
          >
            {memo}
          </Typography>
        )}
        {visibleTypography}
      </Stack>
    );
  }

  return (
    <Stack
      data-testid="memo-expandable-text"
      spacing={0.25}
      sx={{ mt: 0.5, maxWidth: "100%", position: "relative" }}
    >
      {visibleTypography}
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
