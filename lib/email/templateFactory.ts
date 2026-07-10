import * as v from "valibot";
import {
  TRANSACTIONAL_EMAIL_TYPES,
  type BuiltEmail,
  type TransactionalEmailPayload,
  type TransactionalEmailType,
} from "./model";
import {
  EMAIL_DELIVERY_TEST_TYPE,
  emailDeliveryTestPayloadSchema,
  emailDeliveryTestSubject,
  renderEmailDeliveryTest,
} from "./templates/emailDeliveryTestTemplate";

export type TemplateDefinition<T extends TransactionalEmailType = TransactionalEmailType> = {
  type: T;
  subject: string;
  schema: v.BaseSchema<
    TransactionalEmailPayload[T],
    TransactionalEmailPayload[T],
    v.BaseIssue<unknown>
  >;
  render: (payload: TransactionalEmailPayload[T]) => Promise<BuiltEmail>;
};

export const templateDefinitions: TemplateDefinition[] = [
  {
    type: EMAIL_DELIVERY_TEST_TYPE,
    subject: emailDeliveryTestSubject,
    schema: emailDeliveryTestPayloadSchema as unknown as v.BaseSchema<
      TransactionalEmailPayload[typeof EMAIL_DELIVERY_TEST_TYPE],
      TransactionalEmailPayload[typeof EMAIL_DELIVERY_TEST_TYPE],
      v.BaseIssue<unknown>
    >,
    render: renderEmailDeliveryTest as unknown as TemplateDefinition["render"],
  },
];

export const templateDefinitionsByType = new Map<TransactionalEmailType, TemplateDefinition>(
  templateDefinitions.map((def) => [def.type, def]),
);

export function validatePayloadForTemplate<T extends TransactionalEmailType>(
  type: T,
  payload: unknown,
):
  | { success: true; data: TransactionalEmailPayload[T] }
  | { success: false; issues: v.BaseIssue<unknown>[] } {
  const definition = templateDefinitionsByType.get(type);
  if (!definition) {
    return {
      success: false,
      issues: [{ message: `Unknown template type: ${type}`, path: [{ key: "type" }] }] as any,
    };
  }
  const result = v.safeParse(definition.schema, payload);
  if (result.success) {
    return { success: true, data: result.output as TransactionalEmailPayload[T] };
  }
  return { success: false, issues: result.issues };
}

export async function buildTransactionalEmail<T extends TransactionalEmailType>(
  type: T,
  payload: TransactionalEmailPayload[T],
): Promise<BuiltEmail> {
  const definition = templateDefinitionsByType.get(type);
  if (!definition) {
    throw new Error(`Unknown template type: ${type}`);
  }
  return definition.render(payload);
}

export function getTemplateSubject(type: TransactionalEmailType): string | undefined {
  return templateDefinitionsByType.get(type)?.subject;
}

export { TRANSACTIONAL_EMAIL_TYPES };
