import { randomUUID } from "node:crypto";
import type { AgentSettings } from "../config/types.js";
import type { ListingContent } from "./buildListing.js";
import { uploadPicturesToEbay } from "../ebay/pictures.js";
import { upsertInventoryItem, createOffer, publishOffer } from "../ebay/inventory.js";

export interface PublishResult {
  sku: string;
  offerId: string;
  ebayListingId: string;
  imageUrls: string[];
}

export async function publishListing(
  imagePaths: string[],
  content: ListingContent,
  price: number,
  settings: AgentSettings,
): Promise<PublishResult> {
  if (!content.categoryId) {
    throw new Error("Impossible de publier sans categorie eBay identifiee");
  }

  const sku = `EBAYAGENT-${randomUUID()}`;
  const imageUrls = await uploadPicturesToEbay(imagePaths);

  await upsertInventoryItem({
    sku,
    condition: content.condition,
    product: {
      title: content.title,
      description: content.description,
      aspects: content.aspects,
      imageUrls,
    },
    availability: { shipToLocationAvailability: { quantity: 1 } },
  });

  const offerId = await createOffer({
    sku,
    categoryId: content.categoryId,
    price,
    currency: "EUR",
    merchantLocationKey: settings.seller.merchantLocationKey,
    paymentPolicyId: settings.seller.paymentPolicyId,
    returnPolicyId: settings.seller.returnPolicyId,
    shippingPolicyId: settings.seller.shippingPolicyId,
  });

  const ebayListingId = await publishOffer(offerId);

  return { sku, offerId, ebayListingId, imageUrls };
}
