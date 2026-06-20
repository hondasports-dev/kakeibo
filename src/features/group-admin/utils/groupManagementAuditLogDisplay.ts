export type GroupManagementAuditLogListItem = {
  _id: string;
  action: string;
  actionLabel: string;
  actorDisplayName: string;
  targetLabel: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  createdAt: number;
};

export function getManagementAuditLogDetailLabel(log: GroupManagementAuditLogListItem): string {
  if (
    (log.action === "group_name_changed" || log.action === "member_role_changed") &&
    log.beforeValue &&
    log.afterValue
  ) {
    return `${log.beforeValue} → ${log.afterValue}`;
  }

  if (log.targetLabel) {
    return log.targetLabel;
  }

  return "—";
}
