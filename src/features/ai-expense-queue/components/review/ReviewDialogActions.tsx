import { Button, DialogActions } from "@mui/material";
import type { ReviewFormValues } from "../../types/types";

export function ReviewDialogActions({
  showSummaryView,
  reviewSubmitting,
  isSubmitDisabled,
  canResetToAiInterpretation = false,
  onClose,
  onEnterEditMode,
  onExitEditMode,
  onResetToAiInterpretation,
  onSubmit,
}: {
  showSummaryView: boolean;
  reviewSubmitting: boolean;
  isSubmitDisabled: boolean;
  canResetToAiInterpretation?: boolean;
  onClose: () => void;
  onEnterEditMode: () => void;
  onExitEditMode: () => void;
  onResetToAiInterpretation?: () => void;
  onSubmit: (
    registerAfterUpdate: boolean,
    registrationModeOverride?: ReviewFormValues["registrationMode"],
  ) => void;
}) {
  return (
    <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
      <Button disabled={reviewSubmitting} onClick={onClose} type="button">
        閉じる
      </Button>
      {canResetToAiInterpretation && onResetToAiInterpretation ? (
        <Button
          color="warning"
          disabled={reviewSubmitting}
          onClick={onResetToAiInterpretation}
          type="button"
          variant="text"
        >
          AI判定へ戻す
        </Button>
      ) : null}
      {showSummaryView ? (
        <>
          <Button
            disabled={isSubmitDisabled}
            onClick={onEnterEditMode}
            type="button"
            variant="outlined"
          >
            修正する
          </Button>
          <Button
            disabled={isSubmitDisabled}
            onClick={() => onSubmit(false, "totalOnly")}
            type="button"
            variant="outlined"
          >
            レシート合計だけ保存
          </Button>
          <Button
            disabled={isSubmitDisabled}
            onClick={() => onSubmit(false, "detailed")}
            type="button"
            variant="contained"
          >
            この内容で保存
          </Button>
        </>
      ) : (
        <>
          <Button disabled={reviewSubmitting} onClick={onExitEditMode} type="button" variant="text">
            確認に戻る
          </Button>
          <Button
            disabled={isSubmitDisabled}
            onClick={() => onSubmit(false, "totalOnly")}
            type="button"
            variant="outlined"
          >
            レシート合計だけ保存
          </Button>
          <Button
            disabled={isSubmitDisabled}
            onClick={() => onSubmit(false, "detailed")}
            type="button"
            variant="contained"
          >
            この内容で保存
          </Button>
        </>
      )}
    </DialogActions>
  );
}
