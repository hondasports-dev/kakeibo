import {
  type BuiltEmail,
  type TransactionalEmailPayload,
  type TransactionalEmailType,
} from "./model";
import { templateDefinitionsByType } from "./templateDefinitions";
import { renderEmailDeliveryTest } from "./templates/emailDeliveryTestTemplate";

export { validatePayloadForTemplate, getTemplateSubject } from "./templateDefinitions";

const renderers: Record<TransactionalEmailType, (payload: unknown) => Promise<BuiltEmail>> = {
  email_delivery_test: (payload) =>
    renderEmailDeliveryTest(payload as TransactionalEmailPayload["email_delivery_test"]),
};

export async function buildTransactionalEmail<T extends TransactionalEmailType>(
  type: T,
  payload: TransactionalEmailPayload[T],
): Promise<BuiltEmail> {
  const definition = templateDefinitionsByType.get(type);
  if (!definition) {
    throw new Error(`Unknown template type: ${type}`);
  }
  const render = renderers[type];
  if (!render) {
    throw new Error(`No renderer for template type: ${type}`);
  }
  return render(payload);
}
