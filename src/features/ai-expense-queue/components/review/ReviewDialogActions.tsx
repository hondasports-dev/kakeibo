import { Button, DialogActions } from "@mui/material";

export function ReviewDialogActions({
  showSummaryView,
  reviewSubmitting,
  isSubmitDisabled,
  onClose,
  onEnterEditMode,
  onExitEditMode,
  onSubmit,
}: {
  showSummaryView: boolean;
  reviewSubmitting: boolean;
  isSubmitDisabled: boolean;
  onClose: () => void;
  onEnterEditMode: () => void;
  onExitEditMode: () => void;
  onSubmit: (registerAfterUpdate: boolean) => void;
}) {
  return (
    <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
      <Button disabled={reviewSubmitting} onClick={onClose} type="button">
        閉じる
      </Button>
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
            onClick={() => onSubmit(false)}
            type="button"
            variant="contained"
          >
            保存して閉じる
          </Button>
        </>
      ) : (
        <>
          <Button disabled={reviewSubmitting} onClick={onExitEditMode} type="button" variant="text">
            確認に戻る
          </Button>
          <Button
            disabled={isSubmitDisabled}
            onClick={() => onSubmit(false)}
            type="button"
            variant="contained"
          >
            保存して閉じる
          </Button>
        </>
      )}
    </DialogActions>
  );
}
