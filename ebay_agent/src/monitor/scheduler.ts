import cron from "node-cron";
import { loadSettings } from "../config/settings.js";
import { listActiveListings, updateListing, type ListingRecord } from "../db/repositories/listings.js";
import { updateItem } from "../db/repositories/items.js";
import { getPriceHistory, recordPriceChange } from "../db/repositories/priceHistory.js";
import { isSkuSold } from "../ebay/fulfillment.js";
import { searchByKeywords } from "../ebay/browse.js";
import { updateOfferPrice } from "../ebay/inventory.js";
import { computeReprice } from "../pricing/strategy.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("monitor");

function daysSince(iso: string | undefined): number {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

async function checkListing(listing: ListingRecord): Promise<void> {
  const sold = await isSkuSold(listing.sku);
  if (sold) {
    updateListing(listing.id, { status: "sold" });
    updateItem(listing.itemId, { status: "sold" });
    logger.info(`Annonce ${listing.id} (${listing.title}) vendue, ajustements de prix arretes.`);
    return;
  }

  const settings = loadSettings();
  const history = getPriceHistory(listing.id);
  const initialPrice = history[0]?.price ?? listing.price;

  const comparables = await searchByKeywords(listing.title);
  const decision = computeReprice({
    currentPrice: listing.price,
    initialPrice,
    minPrice: settings.autoPublish.minPrice,
    daysSincePublished: daysSince(listing.publishedAt),
    marketPrices: comparables.map((c) => c.price),
    pricing: settings.pricing,
  });

  if (decision.newPrice === null) {
    logger.debug(`Pas d'ajustement pour ${listing.title} : ${decision.reason}`);
    return;
  }

  if (!listing.offerId) {
    logger.warn(`Annonce ${listing.id} sans offerId, impossible de repricer.`);
    return;
  }

  await updateOfferPrice(listing.offerId, decision.newPrice, listing.currency);
  updateListing(listing.id, { price: decision.newPrice });
  recordPriceChange({ listingId: listing.id, price: decision.newPrice, reason: decision.reason });
  logger.info(`Prix ajuste pour ${listing.title} : ${listing.price} € -> ${decision.newPrice} € (${decision.reason})`);
}

export async function runMonitoringPass(): Promise<void> {
  const listings = listActiveListings();
  logger.info(`Surveillance de ${listings.length} annonce(s) active(s)...`);
  for (const listing of listings) {
    try {
      await checkListing(listing);
    } catch (error) {
      logger.error(`Erreur pendant la surveillance de ${listing.id}`, error);
    }
  }
}

/** Planification 100% locale (node-cron) : aucun service cloud tiers requis. */
export function startMonitorScheduler(): void {
  const settings = loadSettings();
  const hours = Math.min(23, Math.max(1, Math.round(settings.pricing.repriceEveryHours)));
  const expression = `0 */${hours} * * *`;
  logger.info(`Scheduler de repricing demarre (toutes les ${hours}h, cron: ${expression})`);
  cron.schedule(expression, () => {
    runMonitoringPass().catch((error) => logger.error("Erreur pendant la passe de surveillance", error));
  });
}
