import type { Identification } from "../vision/identify.js";
import { searchByGtin, searchByKeywords, type Comparable } from "../ebay/browse.js";
import { suggestCategory, getItemAspectsForCategory, type Aspect } from "../ebay/taxonomy.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("research");

export interface MarketResearch {
  categoryId?: string;
  categoryName?: string;
  comparables: Comparable[];
  aspects: Aspect[];
  combinedConfidence: number;
}

function buildSearchQuery(identification: Identification): string {
  const parts = [identification.brand, identification.model, ...identification.keywords.slice(0, 4)].filter(Boolean);
  return parts.join(" ").trim();
}

export async function researchMarket(identification: Identification): Promise<MarketResearch> {
  let comparables: Comparable[] = [];
  try {
    if (identification.gtin) {
      comparables = await searchByGtin(identification.gtin);
    }
  } catch (error) {
    logger.warn("Recherche par code-barres impossible, bascule sur mots-cles", error);
  }

  const query = buildSearchQuery(identification);
  let categoryId: string | undefined;
  let categoryName: string | undefined;
  try {
    if (query) {
      const suggestion = await suggestCategory(query);
      categoryId = suggestion?.categoryId;
      categoryName = suggestion?.categoryName;
    }
  } catch (error) {
    logger.warn("Suggestion de categorie impossible", error);
  }

  if (comparables.length === 0 && query) {
    try {
      comparables = await searchByKeywords(query, categoryId);
    } catch (error) {
      logger.warn("Recherche par mots-cles impossible", error);
    }
  }

  let aspects: Aspect[] = [];
  if (categoryId) {
    try {
      aspects = await getItemAspectsForCategory(categoryId);
    } catch (error) {
      logger.warn(`Recuperation des caracteristiques impossible pour la categorie ${categoryId}`, error);
    }
  }

  let combinedConfidence = identification.confidence;
  if (comparables.length >= 3) combinedConfidence = Math.min(99, combinedConfidence + 10);
  else if (comparables.length === 0) combinedConfidence = Math.max(0, combinedConfidence - 15);

  return { categoryId, categoryName, comparables, aspects, combinedConfidence };
}
