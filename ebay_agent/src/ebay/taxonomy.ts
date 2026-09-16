import { appGet } from "./http.js";
import { loadEbayConfig } from "./config.js";

interface CategoryTreeIdResponse {
  categoryTreeId: string;
}

interface CategorySuggestion {
  category: { categoryId: string; categoryName: string };
  categoryTreeNodeAncestors?: { categoryId: string; categoryName: string }[];
  relevancy?: string;
}

interface CategorySuggestionsResponse {
  categorySuggestions?: CategorySuggestion[];
}

export interface AspectConstraint {
  aspectRequired: boolean;
  aspectUsage?: string;
}

export interface Aspect {
  localizedAspectName: string;
  aspectConstraint: AspectConstraint;
  aspectValues?: { localizedValue: string }[];
}

interface ItemAspectsResponse {
  aspects?: Aspect[];
}

let cachedTreeId: string | undefined;

export async function getDefaultCategoryTreeId(): Promise<string> {
  if (cachedTreeId) return cachedTreeId;
  const { marketplaceId } = loadEbayConfig();
  const data = await appGet<CategoryTreeIdResponse>("/commerce/taxonomy/v1/get_default_category_tree_id", {
    marketplace_id: marketplaceId,
  });
  cachedTreeId = data.categoryTreeId;
  return cachedTreeId;
}

/** Suggestion automatique de categorie eBay a partir de mots-cles produit (API gratuite). */
export async function suggestCategory(query: string): Promise<{ categoryId: string; categoryName: string } | undefined> {
  const treeId = await getDefaultCategoryTreeId();
  const data = await appGet<CategorySuggestionsResponse>(
    `/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions`,
    { q: query },
  );
  const best = data.categorySuggestions?.[0];
  return best ? { categoryId: best.category.categoryId, categoryName: best.category.categoryName } : undefined;
}

/** Caracteristiques (obligatoires ou non) attendues par eBay pour une categorie donnee. */
export async function getItemAspectsForCategory(categoryId: string): Promise<Aspect[]> {
  const treeId = await getDefaultCategoryTreeId();
  const data = await appGet<ItemAspectsResponse>(
    `/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category`,
    { category_id: categoryId },
  );
  return data.aspects ?? [];
}
