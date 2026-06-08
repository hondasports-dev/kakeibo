import type { Id } from "./_generated/dataModel";

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

// ---------------------------------------------------------------------------
// 内部ヘルパー
// ---------------------------------------------------------------------------

/**
 * キーワードとカテゴリ名の部分一致スコアを返す。
 * 完全一致: 2点 / 部分一致: 1点 / 不一致: 0点
 */
function matchScore(keyword: string, categoryName: string): number {
  const kw = keyword.trim().toLowerCase();
  const cn = categoryName.trim().toLowerCase();
  if (!kw) return 0;
  if (cn === kw) return 2;
  if (cn.includes(kw) || kw.includes(cn)) return 1;
  return 0;
}

/** スコアを積算して候補リストを並び替え、上位 CATEGORY_CANDIDATE_MAX 件を返す */
function rankAndLimit(
  categories: CategoryLike[],
  scoreFn: (cat: CategoryLike) => number,
): CategoryLike[] {
  const scored = categories.map((cat) => ({ cat, score: scoreFn(cat) }));
  // スコア降順 → 元の順序（sortOrder）安定
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, CATEGORY_CANDIDATE_MAX).map((s) => s.cat);
}

// ---------------------------------------------------------------------------
// 公開関数
// ---------------------------------------------------------------------------

/**
 * 画像認識の抽出結果をもとに、カテゴリ候補リストを生成する。
 *
 * - コンビニ払込票では paymentPurpose / payeeName を優先し、
 *   paymentPlace（支払場所）をカテゴリ判定の主軸にしない。
 * - categoryName が与えられた場合は完全一致カテゴリを先頭に置く。
 * - 全カテゴリが CATEGORY_CANDIDATE_MAX 以下なら全件を返す。
 */
export function buildCategoryCandidates(input: BuildCategoryCandidatesInput): CategoryLike[] {
  const { documentType, categoryName, shopName, payeeName, paymentPurpose, categories } = input;
  // 注: paymentPlace は input に含まれるが、コンビニ払込票では意図的に使用しない

  if (categories.length === 0) return [];

  // スコアリングのキーワードを収集
  // コンビニ払込票では paymentPlace を主軸にせず、paymentPurpose / payeeName を使う
  const keywords: string[] = [];

  if (categoryName?.trim()) {
    keywords.push(categoryName.trim());
  }

  if (documentType === "convenience_payment") {
    if (paymentPurpose?.trim()) keywords.push(paymentPurpose.trim());
    if (payeeName?.trim()) keywords.push(payeeName.trim());
    // paymentPlace は意図的に除外（コンビニ店名がカテゴリにならないよう）
  } else {
    // receipt / unknown では shopName / payeeName を利用
    if (shopName?.trim()) keywords.push(shopName.trim());
    if (payeeName?.trim()) keywords.push(payeeName.trim());
  }

  // キーワードがなければ全件を元の順序で返す（上限あり）
  if (keywords.length === 0) {
    return categories.slice(0, CATEGORY_CANDIDATE_MAX);
  }

  return rankAndLimit(categories, (cat) =>
    keywords.reduce((sum, kw) => sum + matchScore(kw, cat.name), 0),
  );
}

/**
 * 候補リストの中から AI が推定した categoryName に完全一致するカテゴリの ID を返す。
 * 一致なし・空文字・undefined の場合は undefined を返す。
 */
export function resolveCategoryIdFromCandidates(
  categoryName: string | undefined,
  candidates: CategoryLike[],
): Id<"categories"> | undefined {
  const target = categoryName?.trim();
  if (!target) return undefined;
  return candidates.find((cat) => cat.name === target)?._id;
}
