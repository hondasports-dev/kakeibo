import * as v from "valibot";
import { type TransactionalEmailPayload, type TransactionalEmailType } from "./model";

export type TemplateMetadata = {
  type: TransactionalEmailType;
  subject: string;
  schema: v.BaseSchema<
    unknown,
    TransactionalEmailPayload[TransactionalEmailType],
    v.BaseIssue<unknown>
  >;
};

export const EMAIL_DELIVERY_TEST_TYPE: TransactionalEmailType = "email_delivery_test";

export const emailDeliveryTestSubject = "Suzumemo メール配信テスト";

export const emailDeliveryTestPayloadSchema = v.object({
  to: v.string(),
  groupName: v.optional(v.string()),
});

export const templateDefinitions: TemplateMetadata[] = [
  {
    type: EMAIL_DELIVERY_TEST_TYPE,
    subject: emailDeliveryTestSubject,
    schema: emailDeliveryTestPayloadSchema as unknown as v.BaseSchema<
      unknown,
      TransactionalEmailPayload[typeof EMAIL_DELIVERY_TEST_TYPE],
      v.BaseIssue<unknown>
    >,
  },
];

export const templateDefinitionsByType = new Map<TransactionalEmailType, TemplateMetadata>(
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
      issues: [
        { message: `Unknown template type: ${type}`, path: [{ key: "type" }] },
      ] as unknown as v.BaseIssue<unknown>[],
    };
  }
  const result = v.safeParse(definition.schema, payload);
  if (result.success) {
    return { success: true, data: result.output as TransactionalEmailPayload[T] };
  }
  return { success: false, issues: result.issues };
}

export function getTemplateSubject(type: TransactionalEmailType): string | undefined {
  return templateDefinitionsByType.get(type)?.subject;
}
