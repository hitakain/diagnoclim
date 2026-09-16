import axios from "axios";
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { getUserAccessToken } from "./auth.js";
import { loadEbayConfig } from "./config.js";

const SITE_IDS: Record<string, string> = {
  EBAY_US: "0",
  EBAY_GB: "3",
  EBAY_DE: "77",
  EBAY_FR: "71",
  EBAY_IT: "101",
  EBAY_ES: "186",
};

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function extractTag(xml: string, tag: string): string | undefined {
  return xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1];
}

/**
 * Heberge une photo sur eBay Picture Services (EPS) via l'API Trading historique
 * (Sell Inventory API n'accepte que des URLs deja hebergees). Gratuit, inclus avec
 * les cles developpeur eBay standard, aucun stockage/CDN tiers a payer.
 */
export async function uploadPictureToEbay(imagePath: string): Promise<string> {
  const token = await getUserAccessToken();
  const { marketplaceId } = loadEbayConfig();
  const siteId = SITE_IDS[marketplaceId] ?? "0";
  const contentType = MIME_TYPES[extname(imagePath).toLowerCase()] ?? "image/jpeg";
  const imageBuffer = readFileSync(imagePath);
  const boundary = "EBAY_AGENT_MIME_BOUNDARY";

  const xmlRequest =
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">` +
    `<PictureName>${basename(imagePath)}</PictureName>` +
    `</UploadSiteHostedPicturesRequest>`;

  const parts = [
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="XML Payload"\r\nContent-Type: text/xml;charset=utf-8\r\n\r\n${xmlRequest}\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${basename(imagePath)}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    ),
    imageBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];
  const body = Buffer.concat(parts);

  const { data } = await axios.post<string>("https://api.ebay.com/ws/api.dll", body, {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "X-EBAY-API-CALL-NAME": "UploadSiteHostedPictures",
      "X-EBAY-API-SITEID": siteId,
      "X-EBAY-API-COMPATIBILITY-LEVEL": "1155",
      "X-EBAY-API-IAF-TOKEN": token,
    },
    maxBodyLength: Infinity,
  });

  const url = extractTag(data, "FullURL");
  if (!url) {
    const errorMessage = extractTag(data, "ShortMessage") ?? "reponse EPS inattendue";
    throw new Error(`Echec de l'hebergement de la photo sur eBay: ${errorMessage}`);
  }
  return url;
}

export async function uploadPicturesToEbay(imagePaths: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const path of imagePaths) {
    urls.push(await uploadPictureToEbay(path));
  }
  return urls;
}
