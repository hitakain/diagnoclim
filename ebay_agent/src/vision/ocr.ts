import { createWorker } from "tesseract.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ocr");

export interface OcrResult {
  imagePath: string;
  text: string;
  confidence: number;
}

/**
 * OCR 100% local via tesseract.js (WASM) : aucun envoi de photo a un service tiers,
 * aucun cout, fonctionne hors-ligne une fois les donnees de langue mises en cache.
 */
export async function runOcr(imagePath: string, lang = "fra+eng"): Promise<OcrResult> {
  const worker = await createWorker(lang);
  try {
    const { data } = await worker.recognize(imagePath);
    return { imagePath, text: data.text.trim(), confidence: data.confidence };
  } catch (error) {
    logger.warn(`OCR impossible sur ${imagePath}`, error);
    return { imagePath, text: "", confidence: 0 };
  } finally {
    await worker.terminate();
  }
}

export async function runOcrOnMany(imagePaths: string[], lang = "fra+eng"): Promise<OcrResult[]> {
  const results: OcrResult[] = [];
  for (const imagePath of imagePaths) {
    results.push(await runOcr(imagePath, lang));
  }
  return results;
}
