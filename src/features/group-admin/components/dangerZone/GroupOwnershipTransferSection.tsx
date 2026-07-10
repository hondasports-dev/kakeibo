import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { GroupMemberListItem } from "../../utils/groupMemberDisplay";
import { getMemberPrimaryLabel } from "../../utils/groupMemberDisplay";

type GroupOwnershipTransferSectionProps = {
  transferableMembers: GroupMemberListItem[];
  transferTargetUserId: string;
  disabled: boolean;
  onChangeTransferTarget: (userId: string) => void;
  onRequestTransfer: () => void;
};

export function GroupOwnershipTransferSection({
  transferableMembers,
  transferTargetUserId,
  disabled,
  onChangeTransferTarget,
  onRequestTransfer,
}: GroupOwnershipTransferSectionProps) {
  return (
    <Box>
      <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
        オーナー権限の譲渡
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1.5 }} variant="body2">
        譲渡後、あなたはメンバーになり、管理操作を実行できなくなります。
      </Typography>
      {transferableMembers.length === 0 ? (
        <Alert severity="info" variant="outlined">
          譲渡先となるメンバーがいません。
        </Alert>
      ) : (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            aria-label="譲渡先メンバー"
            data-testid="ownership-transfer-target-select"
            disabled={disabled}
            fullWidth
            onChange={(event) => onChangeTransferTarget(event.target.value)}
            select
            size="small"
            value={transferTargetUserId}
          >
            <MenuItem disabled value="">
              譲渡先を選択
            </MenuItem>
            {transferableMembers.map((member) => (
              <MenuItem key={member.userId} value={member.userId}>
                {getMemberPrimaryLabel(member, null)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            color="error"
            data-testid="ownership-transfer-request-button"
            disabled={disabled || transferTargetUserId === ""}
            onClick={onRequestTransfer}
            variant="outlined"
          >
            譲渡を開始
          </Button>
        </Stack>
      )}
    </Box>
  );
}
