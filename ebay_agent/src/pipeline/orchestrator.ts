import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { loadSettings } from "../config/settings.js";
import { identifyFromPhotos } from "../vision/identify.js";
import { researchMarket } from "./research.js";
import { buildListingContent } from "./buildListing.js";
import { publishListing } from "./publish.js";
import { evaluateAutoPublish, type ListingDraft } from "../decision/autoPublish.js";
import { createItem, updateItem } from "../db/repositories/items.js";
import { createListing } from "../db/repositories/listings.js";
import { recordPriceChange } from "../db/repositories/priceHistory.js";
import { enqueueReview } from "../db/repositories/reviewQueue.js";
import { bumpChoiceCount } from "../db/repositories/preferences.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("orchestrator");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

export interface PipelineStepEvent {
  step: string;
  message: string;
}

export interface PipelineResult {
  itemId: string;
  status: "published" | "pending_review";
  title?: string;
  price?: number;
  ebayListingId?: string;
  question?: string;
}

function listPhotos(photosDir: string): string[] {
  return readdirSync(photosDir)
    .filter((file) => IMAGE_EXTENSIONS.has(extname(file).toLowerCase()))
    .map((file) => join(photosDir, file));
}

export async function runSellPipeline(
  photosDir: string,
  onStep?: (event: PipelineStepEvent) => void,
): Promise<PipelineResult> {
  const emit = (step: string, message: string) => {
    logger.info(message);
    onStep?.({ step, message });
  };

  const settings = loadSettings();
  const item = createItem(photosDir);

  emit("analyze", "Analyse des photos...");
  const photos = listPhotos(photosDir);
  if (photos.length === 0) {
    throw new Error(`Aucune photo trouvee dans ${photosDir}`);
  }
  const identification = await identifyFromPhotos(photos);
  updateItem(item.id, { identification, identificationConfidence: identification.confidence, status: "analyzing" });
  emit(
    "identify",
    `Produit identifie : ${identification.brand ?? "marque inconnue"} ${identification.model ?? ""} (confiance locale ${identification.confidence}%)`,
  );

  emit("research", "Analyse du marche eBay...");
  const research = await researchMarket(identification);
  emit(
    "research-done",
    `Categorie : ${research.categoryName ?? "non trouvee"} — ${research.comparables.length} annonce(s) comparable(s)`,
  );

  const content = buildListingContent(identification, research, settings);
  emit(
    "price",
    content.priceSuggestion.price !== null
      ? `Prix calcule : ${content.priceSuggestion.price} € (${content.priceSuggestion.reason})`
      : `Prix indetermine (${content.priceSuggestion.reason})`,
  );

  updateItem(item.id, {
    condition: content.condition,
    categoryId: content.categoryId,
    identificationConfidence: research.combinedConfidence,
  });

  const draft: ListingDraft = {
    title: content.title,
    categoryId: content.categoryId ?? "unknown",
    price: content.priceSuggestion.price,
    identificationConfidence: research.combinedConfidence,
    missingRequiredAspects: content.missingRequiredAspects,
  };
  const decision = content.categoryId
    ? evaluateAutoPublish(draft, settings.autoPublish)
    : {
        action: "review" as const,
        reason: "aucune categorie eBay identifiee avec certitude",
        question: `Je n'arrive pas a determiner la categorie eBay de "${content.title}". Peux-tu preciser de quel type de produit il s'agit ?`,
      };

  if (decision.action === "review") {
    updateItem(item.id, { status: "pending_review" });
    const review = enqueueReview(item.id, decision.question ?? decision.reason);
    emit("review", `Validation requise : ${decision.reason}`);
    return { itemId: item.id, status: "pending_review", title: content.title, question: review.question };
  }

  emit("publish", "Creation et publication de l'annonce sur eBay...");
  const published = await publishListing(photos, content, content.priceSuggestion.price as number, settings);

  const listing = createListing({
    itemId: item.id,
    sku: published.sku,
    offerId: published.offerId,
    ebayListingId: published.ebayListingId,
    title: content.title,
    price: content.priceSuggestion.price as number,
    currency: "EUR",
    publishedAt: new Date().toISOString(),
    status: "active",
  });
  recordPriceChange({ listingId: listing.id, price: listing.price, reason: "publication initiale" });
  updateItem(item.id, { status: "published" });

  if (settings.learning.enabled) {
    bumpChoiceCount("condition", content.condition);
    if (content.categoryId) bumpChoiceCount("category", content.categoryId);
  }

  emit("published", `Annonce publiee sur eBay (ID ${published.ebayListingId}) a ${listing.price} € ✓`);

  return {
    itemId: item.id,
    status: "published",
    title: content.title,
    price: listing.price,
    ebayListingId: published.ebayListingId,
  };
}
