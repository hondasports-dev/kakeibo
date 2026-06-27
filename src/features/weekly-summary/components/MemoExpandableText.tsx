import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Button, Collapse, Typography } from "@mui/material";
import { useId, useState } from "react";

const MEMO_PREVIEW_LENGTH = 40;

export function MemoExpandableText({ memo }: { memo: string }) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const needsCollapse = memo.length > MEMO_PREVIEW_LENGTH;
  const previewText = needsCollapse ? `${memo.slice(0, MEMO_PREVIEW_LENGTH)}…` : memo;

  if (!needsCollapse) {
    return (
      <Typography color="text.secondary" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }} variant="caption">
        {memo}
      </Typography>
    );
  }

  return (
    <>
      {!expanded && (
        <Typography color="text.secondary" id={contentId} sx={{ mt: 0.5 }} variant="caption">
          {previewText}
        </Typography>
      )}
      <Collapse in={expanded}>
        <Typography
          color="text.secondary"
          id={contentId}
          sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}
          variant="caption"
        >
          {memo}
        </Typography>
      </Collapse>
      <Button
        aria-controls={contentId}
        aria-expanded={expanded}
        endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setExpanded((current) => !current)}
        size="small"
        sx={{ alignSelf: "flex-start", minWidth: 0, mt: 0.25, px: 0 }}
        type="button"
        variant="text"
      >
        {expanded ? "閉じる" : "もっと見る"}
      </Button>
    </>
  );
}
