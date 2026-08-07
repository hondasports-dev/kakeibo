import { Button, CircularProgress, Stack, TextField } from "@mui/material";
import GroupSwitchIcon from "@mui/icons-material/SyncAlt";
import MenuItem from "@mui/material/MenuItem";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MAX_GROUP_NAME_LENGTH } from "../../../../lib/domain/groups/groupName";

type GroupListItem = {
  _id: Id<"groups">;
  name: string;
  isActive: boolean;
};

type GroupRenameSectionProps = {
  activeGroupId: Id<"groups"> | "";
  canSwitchGroups: boolean;
  currentGroupId: Id<"groups">;
  currentGroupName: string;
  groupNameDraft: string;
  groups: GroupListItem[];
  isOwner: boolean;
  onSwitchGroup: () => void;
  onUpdateGroupName: () => void;
  savingTarget: string | null;
  setActiveGroupId: (groupId: Id<"groups"> | "") => void;
  setGroupNameDraft: (name: string) => void;
};

function GroupRenameFields({
  canSwitchGroups,
  currentGroupName,
  groupNameDraft,
  isOwner,
  onUpdateGroupName,
  savingTarget,
  setGroupNameDraft,
}: Pick<
  GroupRenameSectionProps,
  | "canSwitchGroups"
  | "currentGroupName"
  | "groupNameDraft"
  | "isOwner"
  | "onUpdateGroupName"
  | "savingTarget"
  | "setGroupNameDraft"
>) {
  if (!isOwner) {
    return null;
  }

  const renameDisabled = canSwitchGroups ? savingTarget === "rename" : savingTarget !== null;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
      <TextField
        disabled={renameDisabled}
        fullWidth
        label="グループ名"
        onChange={(event) => setGroupNameDraft(event.target.value)}
        slotProps={{ htmlInput: { maxLength: MAX_GROUP_NAME_LENGTH } }}
        value={groupNameDraft}
      />
      <Button
        disabled={renameDisabled || groupNameDraft.trim() === currentGroupName.trim()}
        onClick={() => void onUpdateGroupName()}
        startIcon={savingTarget === "rename" ? <CircularProgress size={16} /> : undefined}
        variant="outlined"
      >
        保存
      </Button>
    </Stack>
  );
}

export function GroupRenameSection({
  activeGroupId,
  canSwitchGroups,
  currentGroupId,
  currentGroupName,
  groupNameDraft,
  groups,
  isOwner,
  onSwitchGroup,
  onUpdateGroupName,
  savingTarget,
  setActiveGroupId,
  setGroupNameDraft,
}: GroupRenameSectionProps) {
  if (canSwitchGroups) {
    return (
      <Stack spacing={1.5}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            fullWidth
            label="現在のグループ"
            onChange={(event) => setActiveGroupId(event.target.value as Id<"groups">)}
            select
            value={activeGroupId}
          >
            {groups.map((item) => (
              <MenuItem key={item._id} value={item._id}>
                {item.name}
                {item.isActive ? "（現在）" : ""}
              </MenuItem>
            ))}
          </TextField>
          <Button
            disabled={savingTarget !== null || activeGroupId === currentGroupId}
            onClick={onSwitchGroup}
            startIcon={
              savingTarget === "switch" ? <CircularProgress size={16} /> : <GroupSwitchIcon />
            }
            variant="outlined"
          >
            切り替え
          </Button>
        </Stack>
        <GroupRenameFields
          canSwitchGroups={canSwitchGroups}
          currentGroupName={currentGroupName}
          groupNameDraft={groupNameDraft}
          isOwner={isOwner}
          onUpdateGroupName={onUpdateGroupName}
          savingTarget={savingTarget}
          setGroupNameDraft={setGroupNameDraft}
        />
      </Stack>
    );
  }

  if (isOwner) {
    return (
      <GroupRenameFields
        canSwitchGroups={canSwitchGroups}
        currentGroupName={currentGroupName}
        groupNameDraft={groupNameDraft}
        isOwner={isOwner}
        onUpdateGroupName={onUpdateGroupName}
        savingTarget={savingTarget}
        setGroupNameDraft={setGroupNameDraft}
      />
    );
  }

  return null;
}
