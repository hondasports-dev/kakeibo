import { Button, Stack } from "@mui/material";
import { AnimatedButton } from "../../ui";

interface ExpenseFormActionsProps {
  isMultiMode: boolean;
  isOverExceeded: boolean;
  isSubmitting: boolean;
  onEnterMultiMode: () => void;
}

export function ExpenseFormActions({
  isMultiMode,
  isOverExceeded,
  isSubmitting,
  onEnterMultiMode,
}: ExpenseFormActionsProps) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        bottom: {
          xs: "calc(var(--size-bottom-nav-height) + env(safe-area-inset-bottom) + 8px)",
          sm: "auto",
        },
        flexWrap: "wrap",
        justifyContent: "flex-end",
        minWidth: 0,
        position: { xs: "sticky", sm: "static" },
        py: { xs: 1, sm: 0 },
        zIndex: { xs: 1, sm: "auto" },
        bgcolor: { xs: "background.paper", sm: "transparent" },
      }}
    >
      {!isMultiMode && (
        <Button
          variant="text"
          size="small"
          onClick={onEnterMultiMode}
          aria-label="カテゴリ別の内訳を追加"
          sx={{ minHeight: 44 }}
        >
          カテゴリ別の内訳を追加
        </Button>
      )}
      <AnimatedButton
        type="submit"
        variant="contained"
        disabled={isSubmitting || isOverExceeded}
        loading={isSubmitting}
      >
        保存して次へ
      </AnimatedButton>
    </Stack>
  );
}
