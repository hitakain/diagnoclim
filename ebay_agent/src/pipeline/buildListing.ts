import type { Identification } from "../vision/identify.js";
import type { MarketResearch } from "./research.js";
import type { AgentSettings } from "../config/types.js";
import { suggestPrice, type PriceSuggestion } from "../pricing/strategy.js";
import { generateTitle } from "../content/title.js";
import { generateDescription } from "../content/description.js";
import { getMostFrequentChoice, getPreference } from "../db/repositories/preferences.js";

export interface ListingContent {
  title: string;
  description: string;
  condition: string;
  categoryId?: string;
  categoryName?: string;
  aspects: Record<string, string[]>;
  missingRequiredAspects: string[];
  priceSuggestion: PriceSuggestion;
}

function resolveCondition(categoryId: string | undefined, settings: AgentSettings): string {
  if (categoryId && settings.seller.defaultConditionByCategory[categoryId]) {
    return settings.seller.defaultConditionByCategory[categoryId];
  }
  const learned = getMostFrequentChoice("condition");
  return learned ?? settings.seller.defaultCondition;
}

function resolveAspectValue(
  aspectName: string,
  identification: Identification,
  categoryId: string | undefined,
): string | undefined {
  const lower = aspectName.toLowerCase();
  if (lower.includes("brand") || lower.includes("marque")) return identification.brand;
  if (lower.includes("model") || lower.includes("modele") || lower.includes("modèle")) return identification.model;
  if (categoryId) {
    const learned = getPreference<string>(`aspect.${categoryId}.${aspectName}`);
    if (learned) return learned;
  }
  return undefined;
}

export function buildListingContent(
  identification: Identification,
  research: MarketResearch,
  settings: AgentSettings,
): ListingContent {
  const condition = resolveCondition(research.categoryId, settings);
  const title = generateTitle(identification, research.categoryName, condition);
  const description = generateDescription(identification, research.categoryName, condition);

  const aspects: Record<string, string[]> = {};
  const missingRequiredAspects: string[] = [];
  for (const aspect of research.aspects) {
    const value = resolveAspectValue(aspect.localizedAspectName, identification, research.categoryId);
    if (value) {
      aspects[aspect.localizedAspectName] = [value];
    } else if (aspect.aspectConstraint.aspectRequired) {
      missingRequiredAspects.push(aspect.localizedAspectName);
    }
  }

  const priceSuggestion = suggestPrice(
    research.comparables.map((c) => c.price),
    settings.pricing,
  );

  return {
    title,
    description,
    condition,
    categoryId: research.categoryId,
    categoryName: research.categoryName,
    aspects,
    missingRequiredAspects,
    priceSuggestion,
  };
}
