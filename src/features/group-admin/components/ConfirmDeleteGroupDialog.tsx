import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export type GroupDeletionPreview = {
  groupName: string;
  members: number;
  invitations: number;
  expenseEntries: number;
  receipts: number;
  receiptImages: number;
  aiDrafts: number;
};

type ConfirmDeleteGroupDialogProps = {
  open: boolean;
  preview: GroupDeletionPreview | null | undefined;
  confirmationName: string;
  confirming: boolean;
  onConfirmationNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

function formatImpactLine(label: string, count: number) {
  return `${label}: ${count}件`;
}

export function ConfirmDeleteGroupDialog({
  open,
  preview,
  confirmationName,
  confirming,
  onConfirmationNameChange,
  onCancel,
  onConfirm,
}: ConfirmDeleteGroupDialogProps) {
  const groupName = preview?.groupName ?? "";
  const isNameMatched = confirmationName.trim() === groupName.trim() && groupName.trim().length > 0;

  return (
    <Dialog fullWidth maxWidth="sm" onClose={confirming ? undefined : onCancel} open={open}>
      <DialogTitle>グループを削除しますか？</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="error" variant="outlined">
            この操作により、グループと関連する家計データが削除されます。削除後は復元できません。
          </Alert>

          {preview ? (
            <Stack spacing={0.5}>
              <Typography data-testid="delete-group-target-name" variant="subtitle2">
                削除対象: {preview.groupName}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {formatImpactLine("所属メンバー", preview.members)}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {formatImpactLine("支出/収入データ", preview.expenseEntries)}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {formatImpactLine("レシート", preview.receipts)} /{" "}
                {formatImpactLine("画像", preview.receiptImages)}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {formatImpactLine("AI解析下書き", preview.aiDrafts)}
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {formatImpactLine("招待", preview.invitations)}
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary" variant="body2">
              削除対象の影響範囲を読み込んでいます。
            </Typography>
          )}

          <Typography color="text.secondary" variant="body2">
            users と Clerk アカウントは削除されません。
          </Typography>

          <Typography variant="body2">
            削除を実行するには、グループ名「{groupName}」を入力してください。
          </Typography>

          <TextField
            autoComplete="off"
            disabled={confirming || !preview}
            fullWidth
            label="確認用グループ名"
            onChange={(event) => onConfirmationNameChange(event.target.value)}
            value={confirmationName}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={confirming} onClick={onCancel}>
          戻る
        </Button>
        <Button
          color="error"
          disabled={confirming || !preview || !isNameMatched}
          onClick={onConfirm}
          startIcon={confirming ? <CircularProgress color="inherit" size={16} /> : undefined}
          variant="contained"
        >
          グループを削除する
        </Button>
      </DialogActions>
    </Dialog>
  );
}
