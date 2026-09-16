import { runOcrOnMany } from "./ocr.js";
import { decodeBarcodesOnMany } from "./barcode.js";
import { KNOWN_BRANDS, STOPWORDS } from "../data/brands.js";

export interface Identification {
  rawText: string;
  brand?: string;
  model?: string;
  gtin?: string;
  keywords: string[];
  ocrConfidence: number;
  barcodeFound: boolean;
  /** Confiance locale (0-100), avant recoupement avec le catalogue eBay. */
  confidence: number;
}

const GTIN_FORMATS = new Set(["EAN_13", "EAN_8", "UPC_A", "UPC_E"]);
const MODEL_PATTERN = /\b(?=[A-Za-z0-9-]{4,20}\b)(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{4,20}\b/g;

function extractKeywords(text: string, limit = 12): string[] {
  const words = text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()));
  return Array.from(new Set(words)).slice(0, limit);
}

function findBrand(text: string): string | undefined {
  const lower = text.toLowerCase();
  return KNOWN_BRANDS.find((brand) => lower.includes(brand.toLowerCase()));
}

function findModel(text: string, brand?: string): string | undefined {
  const withoutBrand = brand ? text.replace(new RegExp(brand, "gi"), " ") : text;
  const candidates = withoutBrand.match(MODEL_PATTERN) ?? [];
  return candidates.sort((a, b) => b.length - a.length)[0];
}

export async function identifyFromPhotos(imagePaths: string[]): Promise<Identification> {
  const [ocrResults, barcodeResults] = await Promise.all([
    runOcrOnMany(imagePaths),
    decodeBarcodesOnMany(imagePaths),
  ]);

  const rawText = ocrResults.map((r) => r.text).join("\n").trim();
  const ocrConfidence = ocrResults.length
    ? ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length
    : 0;

  const gtinMatch = barcodeResults.find((b) => GTIN_FORMATS.has(b.format));
  const brand = findBrand(rawText);
  const model = findModel(rawText, brand);
  const keywords = extractKeywords(rawText);

  let confidence = 15;
  if (gtinMatch) confidence += 45;
  if (brand) confidence += 20;
  if (model) confidence += 10;
  confidence += Math.round((ocrConfidence / 100) * 10);
  confidence = Math.min(confidence, 99);

  return {
    rawText,
    brand,
    model,
    gtin: gtinMatch?.text,
    keywords,
    ocrConfidence,
    barcodeFound: Boolean(gtinMatch),
    confidence,
  };
}
