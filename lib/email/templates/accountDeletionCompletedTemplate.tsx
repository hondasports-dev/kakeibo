import { render, toPlainText } from "react-email";
import type { AccountDeletionCompletedPayload, BuiltEmail } from "../model";
import { subjectRenderers } from "../templateDefinitions";
import { AccountDeletionCompleted } from "./AccountDeletionCompleted";

export async function renderAccountDeletionCompleted(
  payload: AccountDeletionCompletedPayload,
): Promise<BuiltEmail> {
  const html = await render(<AccountDeletionCompleted {...payload} />);
  return {
    subject: subjectRenderers.account_deletion_completed(payload),
    html,
    text: toPlainText(html),
  };
}
