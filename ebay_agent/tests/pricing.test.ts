import { describe, expect, it } from "vitest";
import { computeReprice, suggestPrice } from "../src/pricing/strategy.js";
import { DEFAULT_SETTINGS } from "../src/config/types.js";

const pricing = DEFAULT_SETTINGS.pricing;

describe("suggestPrice", () => {
  it("retourne null sans comparable", () => {
    const result = suggestPrice([], pricing);
    expect(result.price).toBeNull();
    expect(result.sampleSize).toBe(0);
  });

  it("calcule une mediane avec undercut", () => {
    const result = suggestPrice([10, 20, 30], { ...pricing, strategy: "median", undercutPercent: 5, marginPercent: 0 });
    expect(result.basePrice).toBe(20);
    expect(result.price).toBe(19);
  });

  it("applique une marge apres l'undercut", () => {
    const result = suggestPrice([100], { ...pricing, strategy: "median", undercutPercent: 0, marginPercent: 10 });
    expect(result.price).toBe(110);
  });

  it("utilise le minimum avec la strategie min", () => {
    const result = suggestPrice([50, 30, 40], { ...pricing, strategy: "min", undercutPercent: 0, marginPercent: 0 });
    expect(result.basePrice).toBe(30);
  });
});

describe("computeReprice", () => {
  const base = {
    currentPrice: 100,
    initialPrice: 100,
    minPrice: 10,
    daysSincePublished: 5,
    marketPrices: [70, 75, 80],
    pricing: { ...pricing, strategy: "median" as const, undercutPercent: 5, marginPercent: 0, minComparableSample: 3, maxPriceDropPercentPerAdjustment: 10, maxTotalPriceDropPercent: 30, stopAdjustingAfterDays: 30 },
  };

  it("baisse le prix en respectant le plafond de baisse par etape", () => {
    const result = computeReprice(base);
    // marche ~75 -> undercut 5% ~71.25, mais plafonne a 90 (baisse max 10% du prix courant)
    expect(result.newPrice).toBe(90);
  });

  it("arrete les ajustements apres la duree maximale", () => {
    const result = computeReprice({ ...base, daysSincePublished: 31 });
    expect(result.newPrice).toBeNull();
  });

  it("n'ajuste pas si l'echantillon est trop faible", () => {
    const result = computeReprice({ ...base, marketPrices: [70] });
    expect(result.newPrice).toBeNull();
  });

  it("ne change rien si le prix actuel est deja competitif", () => {
    const result = computeReprice({ ...base, marketPrices: [110, 115, 120] });
    expect(result.newPrice).toBeNull();
  });

  it("ne descend jamais sous le prix minimum", () => {
    const result = computeReprice({ ...base, minPrice: 95, marketPrices: [10, 12, 15] });
    expect(result.newPrice).toBe(95);
  });
});
