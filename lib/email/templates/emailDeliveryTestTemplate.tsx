import { render, toPlainText } from "react-email";
import * as v from "valibot";
import {
  type BuiltEmail,
  type EmailDeliveryTestPayload,
  type TransactionalEmailType,
} from "../model";
import { EmailDeliveryTest } from "./EmailDeliveryTest";

export const EMAIL_DELIVERY_TEST_TYPE: TransactionalEmailType = "email_delivery_test";

export const emailDeliveryTestPayloadSchema = v.object({
  to: v.string(),
  groupName: v.optional(v.string()),
});

export const emailDeliveryTestSubject = "Suzumemo メール配信テスト";

export async function renderEmailDeliveryTest(
  payload: EmailDeliveryTestPayload,
): Promise<BuiltEmail> {
  const html = await render(<EmailDeliveryTest to={payload.to} groupName={payload.groupName} />);
  const text = toPlainText(html);
  return {
    subject: emailDeliveryTestSubject,
    html,
    text,
  };
}
