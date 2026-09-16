import Jimp from "jimp";
import {
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from "@zxing/library";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("barcode");

export interface BarcodeResult {
  imagePath: string;
  text: string;
  format: string;
}

const reader = new MultiFormatReader();

/**
 * Lecture de codes-barres / QR 100% locale (zxing-js + jimp), sans service cloud payant.
 * Fiable pour identifier une reference produit (EAN/UPC) quand l'etiquette est visible et nette.
 */
export async function decodeBarcodes(imagePath: string): Promise<BarcodeResult[]> {
  try {
    const image = await Jimp.read(imagePath);
    const { width, height } = image.bitmap;
    const rgba = Uint8ClampedArray.from(image.bitmap.data);
    const source = new RGBLuminanceSource(rgba, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const result = reader.decode(bitmap);
    return [{ imagePath, text: result.getText(), format: String(result.getBarcodeFormat()) }];
  } catch (error) {
    if (!(error instanceof NotFoundException)) {
      logger.debug(`Aucun code-barres detecte sur ${imagePath}`, error);
    }
    return [];
  }
}

export async function decodeBarcodesOnMany(imagePaths: string[]): Promise<BarcodeResult[]> {
  const results: BarcodeResult[] = [];
  for (const imagePath of imagePaths) {
    results.push(...(await decodeBarcodes(imagePath)));
  }
  return results;
}
