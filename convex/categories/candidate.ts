import type { Id } from "../_generated/dataModel";

export {
  buildCategoryCandidates,
  resolveCategoryIdFromCandidates,
  CATEGORY_CANDIDATE_MAX,
} from "../../lib/domain/categories/candidate";

export type CategoryLike = {
  _id: Id<"categories">;
  name: string;
};
