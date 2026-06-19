import {
  Avatar,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  getMemberInitial,
  getMemberPrimaryLabel,
  getMemberSecondaryLabel,
  isCurrentUserMember,
  type GroupMemberListItem,
} from "./groupMemberDisplay";

type GroupMemberListProps = {
  members: GroupMemberListItem[];
  isOwner: boolean;
  currentUserId: string | null | undefined;
  currentUserDisplayName: string | null;
  savingTarget: string | null;
  onRequestRemove?: (member: GroupMemberListItem, displayLabel: string) => void;
};

export function GroupMemberList({
  members,
  isOwner,
  currentUserId,
  currentUserDisplayName,
  savingTarget,
  onRequestRemove,
}: GroupMemberListProps) {
  if (members.length === 0) {
    return (
      <Box
        data-testid="group-member-list-empty"
        sx={{
          p: 1.5,
          border: "1px dashed",
          borderColor: "divider",
          borderRadius: 1,
        }}
      >
        <Typography color="text.secondary" variant="body2">
          まだメンバーがいません。オーナーは招待管理からメンバーを追加できます。
        </Typography>
      </Box>
    );
  }

  return (
    <Box component="ul" className="group-member-list" data-testid="group-member-list">
      {members.map((member) => {
        const canRemove = isOwner && member.role !== "owner";
        const isCurrentUser = isCurrentUserMember(member.userId, currentUserId);
        const primaryLabel = getMemberPrimaryLabel(
          member,
          isCurrentUser ? currentUserDisplayName : null,
        );
        const secondaryLabel = getMemberSecondaryLabel(member, primaryLabel);

        return (
          <Box className="group-member-row" component="li" key={member.userId}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
              <Avatar sx={{ bgcolor: "primary.light", color: "primary.dark" }}>
                {getMemberInitial(primaryLabel)}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Typography sx={{ fontWeight: 700 }} noWrap>
                    {primaryLabel}
                  </Typography>
                  {isCurrentUser ? <Chip label="あなた" size="small" variant="outlined" /> : null}
                </Stack>
                <Typography color="text.secondary" variant="body2" noWrap>
                  {secondaryLabel}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip
                color={member.role === "owner" ? "primary" : "secondary"}
                label={member.role === "owner" ? "オーナー" : "メンバー"}
                size="small"
                variant={member.role === "owner" ? "filled" : "outlined"}
              />
              {isOwner && onRequestRemove ? (
                <Tooltip title={canRemove ? "グループから外す" : "外せません"}>
                  <span>
                    <IconButton
                      aria-label={`${primaryLabel}をグループから外す`}
                      color="error"
                      disabled={!canRemove || savingTarget !== null}
                      onClick={() => onRequestRemove(member, primaryLabel)}
                      size="small"
                    >
                      {savingTarget === member.userId ? (
                        <CircularProgress size={18} />
                      ) : (
                        <DeleteIcon fontSize="small" />
                      )}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}
