import { Button, DialogActions } from "@mui/material";

export function ReviewDialogActions({
  showSummaryView,
  hasLineItems,
  hasMultipleCategories,
  reviewSubmitting,
  isSubmitDisabled,
  onClose,
  onEnterEditMode,
  onExitEditMode,
  onSubmit,
}: {
  showSummaryView: boolean;
  hasLineItems: boolean;
  hasMultipleCategories: boolean;
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
        キャンセル
      </Button>
      {showSummaryView ? (
        <>
          <Button
            disabled={isSubmitDisabled}
            onClick={onEnterEditMode}
            type="button"
            variant="outlined"
          >
            内訳を変更
          </Button>
          <Button
            disabled={isSubmitDisabled}
            onClick={() => onSubmit(true)}
            type="button"
            variant="contained"
          >
            {hasMultipleCategories ? "この内容で登録" : "登録する"}
          </Button>
        </>
      ) : (
        <>
          {hasLineItems && !hasMultipleCategories && (
            <Button
              disabled={reviewSubmitting}
              onClick={onExitEditMode}
              type="button"
              variant="text"
            >
              一覧に戻る
            </Button>
          )}
          {!hasMultipleCategories && (
            <Button
              disabled={isSubmitDisabled}
              onClick={() => onSubmit(false)}
              type="button"
              variant="outlined"
            >
              登録準備OKに戻す
            </Button>
          )}
          {hasMultipleCategories ? (
            <Button
              disabled={isSubmitDisabled}
              onClick={onExitEditMode}
              type="button"
              variant="contained"
            >
              変更内容を確認
            </Button>
          ) : (
            <Button
              disabled={isSubmitDisabled}
              onClick={() => onSubmit(true)}
              type="button"
              variant="contained"
            >
              修正して登録
            </Button>
          )}
        </>
      )}
    </DialogActions>
  );
}
