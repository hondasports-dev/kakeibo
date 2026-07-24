import { SystemAdminErrorBoundary } from "../components/SystemAdminErrorBoundary";
import { AuditLogDetailDialog } from "../components/AuditLogDetailDialog";
import { AuditLogFilters } from "../components/AuditLogFilters";
import { AuditLogList } from "../components/AuditLogList";
import { formatAction, useSystemAdminAuditLog } from "../hooks/useSystemAdminAuditLog";
import { SystemAdminErrorState, SystemAdminPageFrame } from "./SystemAdminPageFrame";

export function SystemAdminAuditLogPage() {
  return (
    <SystemAdminErrorBoundary
      label="SystemAdminAuditLogPage"
      renderError={(retry) => (
        <SystemAdminPageFrame title="監査ログ">
          <SystemAdminErrorState onRetry={retry} />
        </SystemAdminPageFrame>
      )}
    >
      <SystemAdminAuditLogPageContent />
    </SystemAdminErrorBoundary>
  );
}

function SystemAdminAuditLogPageContent() {
  const {
    logs,
    action,
    setAction,
    actor,
    setActor,
    target,
    setTarget,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    setCursor,
    selected,
    setSelected,
    clearFilters,
    hasFilter,
  } = useSystemAdminAuditLog();

  const handleActionChange = (value: typeof action) => {
    setAction(value);
    setCursor(null);
  };

  const handleActorChange = (value: string) => {
    setActor(value);
    setCursor(null);
  };

  const handleTargetChange = (value: string) => {
    setTarget(value);
    setCursor(null);
  };

  const handleFromDateChange = (value: string) => {
    setFromDate(value);
    setCursor(null);
  };

  const handleToDateChange = (value: string) => {
    setToDate(value);
    setCursor(null);
  };

  const handleClear = () => {
    clearFilters();
  };

  return (
    <SystemAdminPageFrame
      description="管理者権限の変更と管理コンソール操作の監査履歴を確認します。"
      title="監査ログ"
    >
      <AuditLogFilters
        action={action}
        actor={actor}
        fromDate={fromDate}
        hasFilter={hasFilter}
        target={target}
        toDate={toDate}
        onActionChange={handleActionChange}
        onActorChange={handleActorChange}
        onClear={handleClear}
        onFromDateChange={handleFromDateChange}
        onTargetChange={handleTargetChange}
        onToDateChange={handleToDateChange}
      />
      <AuditLogList
        formatAction={formatAction}
        hasFilter={hasFilter}
        logs={logs}
        onLoadMore={(cursor) => setCursor(cursor)}
        onSelect={(item) => setSelected(item)}
      />
      <AuditLogDetailDialog
        formatAction={formatAction}
        onClose={() => setSelected(null)}
        selected={selected}
      />
    </SystemAdminPageFrame>
  );
}
