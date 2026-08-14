import { ConvexError } from "convex/values";
import { MAX_GROUP_NAME_LENGTH, validateGroupName } from "../../../lib/domain/groups/groupName";

export { MAX_GROUP_NAME_LENGTH };

/**
 * グループ名を trim し、空文字・長さ超過を検証する。
 * 純粋なドメインルールは {@link validateGroupName} に委ね、ここでは ConvexError に変換する。
 * @throws {ConvexError} 空文字または {@link MAX_GROUP_NAME_LENGTH} 文字超過時
 */
export function normalizeGroupName(name: string): string {
  const result = validateGroupName(name);
  if (!result.success) {
    if (result.error.type === "empty") {
      throw new ConvexError("グループ名を入力してください");
    }
    throw new ConvexError(`グループ名は${MAX_GROUP_NAME_LENGTH}文字以内で入力してください`);
  }
  return result.name;
}
