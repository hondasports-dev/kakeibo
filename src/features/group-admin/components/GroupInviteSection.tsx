import { type FormEvent } from "react";
import { Box, Button, CircularProgress, Stack, TextField } from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { GroupPendingInvitationList } from "./GroupPendingInvitationList";
import type { GroupPendingInvitationListItem } from "../utils/groupInvitationDisplay";
import { GroupSettingsSection } from "./GroupSettingsSection";

type GroupInviteSectionProps = {
  email: string;
  invitations: GroupPendingInvitationListItem[];
  onInviteMember: (event: FormEvent) => void;
  onRequestCancel: (invitation: GroupPendingInvitationListItem) => void;
  savingTarget: string | null;
  setEmail: (email: string) => void;
};

export function GroupInviteSection({
  email,
  invitations,
  onInviteMember,
  onRequestCancel,
  savingTarget,
  setEmail,
}: GroupInviteSectionProps) {
  return (
    <GroupSettingsSection
      description="メール招待の送信と、送信済み招待の確認・取り消しを行います。"
      testId="invite-management-section"
      title="招待管理"
    >
      <Stack spacing={1.5}>
        <Box component="form" onSubmit={onInviteMember}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              disabled={savingTarget !== null}
              fullWidth
              label="招待するメールアドレス"
              name="memberEmail"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
            <Button
              disabled={savingTarget !== null}
              startIcon={
                savingTarget === "add" ? <CircularProgress size={16} /> : <PersonAddIcon />
              }
              type="submit"
              variant="contained"
            >
              招待を送る
            </Button>
          </Stack>
        </Box>

        <GroupPendingInvitationList
          invitations={invitations}
          onRequestCancel={onRequestCancel}
          savingTarget={savingTarget}
        />
      </Stack>
    </GroupSettingsSection>
  );
}
