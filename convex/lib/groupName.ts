import { ConvexError } from "convex/values";

/** グループ名の最大文字数（作成・変更で共通）。 */
export const MAX_GROUP_NAME_LENGTH = 50;

/**
 * グループ名を trim し、空文字・長さ超過を検証する。
 * @throws {ConvexError} 空文字または {@link MAX_GROUP_NAME_LENGTH} 文字超過時
 */
export function normalizeGroupName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ConvexError("グループ名を入力してください");
  }
  if (trimmed.length > MAX_GROUP_NAME_LENGTH) {
    throw new ConvexError(`グループ名は${MAX_GROUP_NAME_LENGTH}文字以内で入力してください`);
  }
  return trimmed;
}
