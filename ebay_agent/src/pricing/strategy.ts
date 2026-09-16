import { PricingSettings } from "../config/types.js";

export interface PriceSuggestion {
  price: number | null;
  basePrice: number | null;
  sampleSize: number;
  reason: string;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function trimmedMean(sorted: number[], trimRatio = 0.1): number {
  const trimCount = Math.floor(sorted.length * trimRatio);
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
  const sample = trimmed.length > 0 ? trimmed : sorted;
  return sample.reduce((sum, v) => sum + v, 0) / sample.length;
}

function computeBasePrice(prices: number[], strategy: PricingSettings["strategy"]): number {
  const sorted = [...prices].sort((a, b) => a - b);
  switch (strategy) {
    case "trimmedMean":
      return trimmedMean(sorted);
    case "min":
      return sorted[0];
    case "median":
    default:
      return median(sorted);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function suggestPrice(prices: number[], pricing: PricingSettings): PriceSuggestion {
  if (prices.length === 0) {
    return { price: null, basePrice: null, sampleSize: 0, reason: "aucun comparable trouve sur eBay" };
  }
  const basePrice = computeBasePrice(prices, pricing.strategy);
  const afterUndercut = basePrice * (1 - pricing.undercutPercent / 100);
  const afterMargin = afterUndercut * (1 + pricing.marginPercent / 100);
  const price = round2(Math.max(afterMargin, 0.01));
  const reason =
    prices.length < pricing.minComparableSample
      ? `echantillon faible (${prices.length} annonce(s) comparable(s))`
      : `base sur ${prices.length} annonces comparables (reference marche: ${round2(basePrice)})`;
  return { price, basePrice: round2(basePrice), sampleSize: prices.length, reason };
}

export interface RepriceInput {
  currentPrice: number;
  initialPrice: number;
  minPrice: number;
  daysSincePublished: number;
  marketPrices: number[];
  pricing: PricingSettings;
}

export interface RepriceDecision {
  newPrice: number | null;
  reason: string;
}

export function computeReprice(input: RepriceInput): RepriceDecision {
  if (input.daysSincePublished >= input.pricing.stopAdjustingAfterDays) {
    return { newPrice: null, reason: "duree maximale d'ajustement automatique atteinte" };
  }
  const suggestion = suggestPrice(input.marketPrices, input.pricing);
  if (suggestion.price === null || suggestion.sampleSize < input.pricing.minComparableSample) {
    return { newPrice: null, reason: "pas assez de comparables actuels pour reevaluer le prix" };
  }

  const floorFromTotalDrop = round2(
    input.initialPrice * (1 - input.pricing.maxTotalPriceDropPercent / 100),
  );
  const floorFromStepDrop = round2(
    input.currentPrice * (1 - input.pricing.maxPriceDropPercentPerAdjustment / 100),
  );
  const floor = Math.max(floorFromTotalDrop, floorFromStepDrop, input.minPrice);

  const target = round2(Math.max(suggestion.price, floor));

  if (target >= input.currentPrice) {
    return { newPrice: null, reason: "prix actuel deja aligne avec le marche" };
  }

  return {
    newPrice: target,
    reason: `marche a ${suggestion.basePrice} sur ${suggestion.sampleSize} comparables, baisse plafonnee a ${floor}`,
  };
}
