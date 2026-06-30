import type { Id } from "../../../../convex/_generated/dataModel";
import { ConfirmDangerousActionDialog } from "./ConfirmDangerousActionDialog";

type GroupInviteCancelDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
  pendingCancelInvitation: {
    invitationId: Id<"groupInvitations">;
    email: string;
  } | null;
  savingTarget: string | null;
};

export function GroupInviteCancelDialog({
  onCancel,
  onConfirm,
  pendingCancelInvitation,
  savingTarget,
}: GroupInviteCancelDialogProps) {
  return (
    <ConfirmDangerousActionDialog
      cancelLabel="戻る"
      confirmLabel="招待を取り消す"
      confirming={
        pendingCancelInvitation !== null && savingTarget === pendingCancelInvitation.invitationId
      }
      description={
        pendingCancelInvitation
          ? `${pendingCancelInvitation.email} への招待を取り消します。送信済みの招待リンクは無効になり、相手はこの招待で参加できなくなります。`
          : ""
      }
      onCancel={onCancel}
      onConfirm={onConfirm}
      open={pendingCancelInvitation !== null}
      title="招待を取り消しますか？"
    />
  );
}
