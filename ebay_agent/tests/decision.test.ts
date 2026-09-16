import { describe, expect, it } from "vitest";
import { evaluateAutoPublish, type ListingDraft } from "../src/decision/autoPublish.js";
import { DEFAULT_SETTINGS } from "../src/config/types.js";

const settings = { ...DEFAULT_SETTINGS.autoPublish, enabled: true, minIdentificationConfidence: 90, minPrice: 5 };

const baseDraft: ListingDraft = {
  title: "Daikin FTXM35 climatiseur",
  categoryId: "12345",
  price: 200,
  identificationConfidence: 97,
  missingRequiredAspects: [],
};

describe("evaluateAutoPublish", () => {
  it("publie automatiquement quand la confiance et le prix sont suffisants", () => {
    const decision = evaluateAutoPublish(baseDraft, settings);
    expect(decision.action).toBe("publish");
  });

  it("demande une verification si la confiance est trop faible", () => {
    const decision = evaluateAutoPublish({ ...baseDraft, identificationConfidence: 58 }, settings);
    expect(decision.action).toBe("review");
    expect(decision.question).toBeDefined();
  });

  it("ne publie jamais si la fonction est desactivee", () => {
    const decision = evaluateAutoPublish(baseDraft, { ...settings, enabled: false });
    expect(decision.action).toBe("review");
  });

  it("bloque une categorie interdite meme a confiance maximale", () => {
    const decision = evaluateAutoPublish(baseDraft, { ...settings, blockedCategoryIds: ["12345"] });
    expect(decision.action).toBe("review");
  });

  it("demande une revue si le prix est sous le minimum", () => {
    const decision = evaluateAutoPublish({ ...baseDraft, price: 2 }, settings);
    expect(decision.action).toBe("review");
  });

  it("demande une revue si le prix est indetermine", () => {
    const decision = evaluateAutoPublish({ ...baseDraft, price: null }, settings);
    expect(decision.action).toBe("review");
  });

  it("demande une revue si une caracteristique obligatoire manque", () => {
    const decision = evaluateAutoPublish({ ...baseDraft, missingRequiredAspects: ["Puissance"] }, settings);
    expect(decision.action).toBe("review");
  });
});
