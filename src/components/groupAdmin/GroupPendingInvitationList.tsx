import { Box, Chip, Stack, Typography } from "@mui/material";
import {
  getInvitationSentAtLabel,
  getInvitationStatusLabel,
  type GroupPendingInvitationListItem,
} from "./groupInvitationDisplay";

type GroupPendingInvitationListProps = {
  invitations: GroupPendingInvitationListItem[];
};

export function GroupPendingInvitationList({ invitations }: GroupPendingInvitationListProps) {
  if (invitations.length === 0) {
    return (
      <Box
        data-testid="group-pending-invitation-list-empty"
        sx={{
          p: 1.5,
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary" variant="body2">
          送信済みの招待はありません。
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component="ul"
      className="group-pending-invitation-list"
      data-testid="group-pending-invitation-list"
    >
      {invitations.map((invitation) => (
        <Box className="group-member-row" component="li" key={invitation._id}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }} noWrap>
                {invitation.email}
              </Typography>
              <Typography color="text.secondary" variant="body2" noWrap>
                {getInvitationSentAtLabel(invitation.createdAt)}
              </Typography>
            </Box>
          </Stack>
          <Chip
            color="warning"
            label={getInvitationStatusLabel(invitation.status)}
            size="small"
            variant="outlined"
          />
        </Box>
      ))}
    </Box>
  );
}
