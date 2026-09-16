import { appGet } from "./http.js";

interface ItemSummary {
  itemId: string;
  title: string;
  price?: { value: string; currency: string };
  condition?: string;
  itemWebUrl?: string;
}

interface SearchResponse {
  itemSummaries?: ItemSummary[];
  total?: number;
}

export interface Comparable {
  itemId: string;
  title: string;
  price: number;
  currency: string;
  condition?: string;
  url?: string;
}

function toComparables(items: ItemSummary[] | undefined): Comparable[] {
  return (items ?? [])
    .filter((i) => i.price?.value)
    .map((i) => ({
      itemId: i.itemId,
      title: i.title,
      price: Number(i.price!.value),
      currency: i.price!.currency,
      condition: i.condition,
      url: i.itemWebUrl,
    }));
}

/**
 * Comparables via l'API Browse (gratuite). Limite connue : elle expose les annonces
 * ACTIVES, pas l'historique des ventes conclues (Terapeak/Marketplace Insights est reserve
 * aux comptes partenaires) -> voir docs/LIMITES_ET_ALTERNATIVES.md.
 */
export async function searchByGtin(gtin: string, limit = 50): Promise<Comparable[]> {
  const data = await appGet<SearchResponse>("/buy/browse/v1/item_summary/search", {
    gtin,
    limit,
  });
  return toComparables(data.itemSummaries);
}

export async function searchByKeywords(keywords: string, categoryId?: string, limit = 50): Promise<Comparable[]> {
  const data = await appGet<SearchResponse>("/buy/browse/v1/item_summary/search", {
    q: keywords,
    category_ids: categoryId,
    limit,
  });
  return toComparables(data.itemSummaries);
}
