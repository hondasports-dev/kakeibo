import { Box, Button, Stack, Typography } from "@mui/material";
import type { GroupMemberListItem } from "../../utils/groupMemberDisplay";
import { getMemberPrimaryLabel } from "../../utils/groupMemberDisplay";
import type { PendingMember } from "./types";

type GroupMemberRemovalSectionProps = {
  members: GroupMemberListItem[];
  disabled: boolean;
  onRequestRemove: (member: PendingMember) => void;
};

export function GroupMemberRemovalSection({
  members,
  disabled,
  onRequestRemove,
}: GroupMemberRemovalSectionProps) {
  if (members.length === 0) {
    return (
      <Box>
        <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
          メンバー解除
        </Typography>
        <Typography color="text.secondary" variant="body2">
          解除できるメンバーはいません。
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography component="h3" sx={{ mb: 1 }} variant="subtitle1">
        メンバー解除
      </Typography>
      <Stack spacing={1}>
        {members.map((member) => {
          const displayLabel = getMemberPrimaryLabel(member, null);
          return (
            <Box className="settings-danger-row" key={member.userId}>
              <Typography sx={{ overflowWrap: "anywhere" }}>{displayLabel}</Typography>
              <Button
                aria-label={`${displayLabel}をグループから外す`}
                color="error"
                disabled={disabled}
                onClick={() => onRequestRemove({ userId: member.userId, displayLabel })}
                size="small"
                variant="outlined"
              >
                グループから外す
              </Button>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
