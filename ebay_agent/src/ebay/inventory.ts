import { userGet, userPost, userPut } from "./http.js";
import { loadEbayConfig } from "./config.js";

export interface InventoryItemPayload {
  sku: string;
  condition: string;
  product: {
    title: string;
    description: string;
    aspects: Record<string, string[]>;
    imageUrls: string[];
  };
  availability: { shipToLocationAvailability: { quantity: number } };
}

export async function upsertInventoryItem(payload: InventoryItemPayload): Promise<void> {
  await userPut(`/sell/inventory/v1/inventory_item/${encodeURIComponent(payload.sku)}`, {
    condition: payload.condition,
    product: payload.product,
    availability: payload.availability,
  });
}

export interface CreateOfferInput {
  sku: string;
  categoryId: string;
  price: number;
  currency: string;
  merchantLocationKey: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  shippingPolicyId: string;
}

interface CreateOfferResponse {
  offerId: string;
}

export async function createOffer(input: CreateOfferInput): Promise<string> {
  const { marketplaceId } = loadEbayConfig();
  const response = await userPost<CreateOfferResponse>("/sell/inventory/v1/offer", {
    sku: input.sku,
    marketplaceId,
    format: "FIXED_PRICE",
    categoryId: input.categoryId,
    pricingSummary: { price: { value: input.price.toFixed(2), currency: input.currency } },
    merchantLocationKey: input.merchantLocationKey,
    listingPolicies: {
      paymentPolicyId: input.paymentPolicyId,
      returnPolicyId: input.returnPolicyId,
      fulfillmentPolicyId: input.shippingPolicyId,
    },
  });
  return response.offerId;
}

interface PublishOfferResponse {
  listingId: string;
}

export async function publishOffer(offerId: string): Promise<string> {
  const response = await userPost<PublishOfferResponse>(`/sell/inventory/v1/offer/${offerId}/publish`);
  return response.listingId;
}

interface OfferDetails {
  offerId: string;
  sku: string;
  categoryId: string;
  pricingSummary: { price: { value: string; currency: string } };
  merchantLocationKey: string;
  listingPolicies: Record<string, string>;
  status: string;
}

export async function getOffer(offerId: string): Promise<OfferDetails> {
  return userGet<OfferDetails>(`/sell/inventory/v1/offer/${offerId}`);
}

/** Repricing : recupere l'offre existante puis republie avec le nouveau prix (API gratuite). */
export async function updateOfferPrice(offerId: string, price: number, currency: string): Promise<void> {
  const offer = await getOffer(offerId);
  await userPut(`/sell/inventory/v1/offer/${offerId}`, {
    sku: offer.sku,
    categoryId: offer.categoryId,
    merchantLocationKey: offer.merchantLocationKey,
    listingPolicies: offer.listingPolicies,
    pricingSummary: { price: { value: price.toFixed(2), currency } },
  });
}
