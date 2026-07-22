import { formatDateTimeForDisplay } from "../../../utils/date";

export type GroupPendingInvitationListItem = {
  _id: string;
  email: string;
  status: "pending";
  createdAt: number;
};

export function getInvitationStatusLabel(status: GroupPendingInvitationListItem["status"]) {
  if (status === "pending") {
    return "招待中";
  }

  return status;
}

export function getInvitationSentAtLabel(createdAt: number) {
  return `招待日時: ${formatDateTimeForDisplay(createdAt)}`;
}
