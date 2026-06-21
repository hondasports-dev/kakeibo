import type { Id } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// カテゴリ候補生成ロジック
//
// Issue #173: 画像認識時にカテゴリの自動判定をさせたい
//
// AIへ全カテゴリを渡すのではなく、アプリ側で候補を絞ってからAIが選ぶ方針。
// このモジュールは純粋関数として分離し、DBへのアクセスを持たない。
// ---------------------------------------------------------------------------

/** 候補として返すカテゴリの最大件数 */
export const CATEGORY_CANDIDATE_MAX = 20;

export type CategoryLike = {
  _id: Id<"categories">;
  name: string;
};

type DocumentType = "receipt" | "convenience_payment" | "unknown";

type BuildCategoryCandidatesInput = {
  documentType: DocumentType;
  /** AIが抽出した推定カテゴリ名 */
  categoryName?: string;
  /** レシートの店名 */
  shopName?: string;
  /** コンビニ払込票の支払場所（カテゴリ判定の主軸にしない） */
  paymentPlace?: string;
  /** 支払先（コンビニ払込票で優先） */
  payeeName?: string;
  /** 支払内容（コンビニ払込票で優先） */
  paymentPurpose?: string;
  /** ユーザーのアクティブカテゴリ全件 */
  categories: CategoryLike[];
};

function matchScore(keyword: string, categoryName: string): number {
  const kw = keyword.trim().toLowerCase();
  const cn = categoryName.trim().toLowerCase();
  if (!kw || !cn) return 0;
  if (cn === kw) return 2;
  if (cn.includes(kw) || kw.includes(cn)) return 1;
  return 0;
}

function rankAndLimit(
  categories: CategoryLike[],
  scoreFn: (cat: CategoryLike) => number,
): CategoryLike[] {
  const scored = categories.map((cat) => ({ cat, score: scoreFn(cat) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, CATEGORY_CANDIDATE_MAX).map((s) => s.cat);
}

export function buildCategoryCandidates(input: BuildCategoryCandidatesInput): CategoryLike[] {
  const { documentType, categoryName, shopName, payeeName, paymentPurpose, categories } = input;

  if (categories.length === 0) return [];

  const keywords: string[] = [];

  if (categoryName?.trim()) {
    keywords.push(categoryName.trim());
  }

  if (documentType === "convenience_payment") {
    if (paymentPurpose?.trim()) keywords.push(paymentPurpose.trim());
    if (payeeName?.trim()) keywords.push(payeeName.trim());
  } else {
    if (shopName?.trim()) keywords.push(shopName.trim());
    if (payeeName?.trim()) keywords.push(payeeName.trim());
  }

  if (keywords.length === 0) {
    return categories.slice(0, CATEGORY_CANDIDATE_MAX);
  }

  return rankAndLimit(categories, (cat) =>
    keywords.reduce((sum, kw) => sum + matchScore(kw, cat.name), 0),
  );
}

export function resolveCategoryIdFromCandidates(
  categoryName: string | undefined,
  candidates: CategoryLike[],
): Id<"categories"> | undefined {
  const target = categoryName?.trim().toLowerCase();
  if (!target) return undefined;
  return candidates.find((cat) => cat.name.toLowerCase() === target)?._id;
}
