import { Alert } from "@mui/material";
import { SystemAdminPageFrame } from "./SystemAdminPageFrame";

export function SystemAdminPlaceholderPage({ title }: { title: string }) {
  return (
    <SystemAdminPageFrame title={title}>
      <Alert severity="info" variant="outlined">
        この管理機能は後続Issueで提供予定です。現在は導線のみ用意しています。
      </Alert>
    </SystemAdminPageFrame>
  );
}
