import { describe, expect, it } from "vitest";
import { generateTitle } from "../src/content/title.js";
import { generateDescription } from "../src/content/description.js";
import type { Identification } from "../src/vision/identify.js";

const identification: Identification = {
  rawText: "Daikin FTXM35N9 climatisation",
  brand: "Daikin",
  model: "FTXM35N9",
  gtin: "4901234567890",
  keywords: ["climatisation", "reversible"],
  ocrConfidence: 80,
  barcodeFound: true,
  confidence: 95,
};

describe("generateTitle", () => {
  it("assemble marque, modele, categorie et etat sans doublon", () => {
    const title = generateTitle(identification, "Climatiseurs", "USED_GOOD");
    expect(title).toContain("Daikin");
    expect(title).toContain("FTXM35N9");
    expect(title).toContain("Climatiseurs");
    expect(title).toContain("Bon etat");
  });

  it("ne depasse jamais 80 caracteres", () => {
    const longIdentification: Identification = {
      ...identification,
      keywords: ["motscletresverylongkeywordone", "motscletresverylongkeywordtwo", "motscletresverylongkeywordthree"],
    };
    const title = generateTitle(longIdentification, "Categorie tres tres longue avec beaucoup de mots", "NEW");
    expect(title.length).toBeLessThanOrEqual(80);
  });

  it("retourne un libelle par defaut si rien n'est identifie", () => {
    const empty: Identification = { rawText: "", keywords: [], ocrConfidence: 0, barcodeFound: false, confidence: 15 };
    const title = generateTitle(empty, undefined, "USED_GOOD");
    expect(title).toBe("Article a identifier");
  });
});

describe("generateDescription", () => {
  it("mentionne l'etat et le code-barres detecte", () => {
    const description = generateDescription(identification, "Climatiseurs", "USED_GOOD");
    expect(description).toContain("Bon etat");
    expect(description).toContain(identification.gtin!);
  });
});
