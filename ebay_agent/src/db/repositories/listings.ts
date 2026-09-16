import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

export type ListingStatus = "draft" | "active" | "sold" | "ended";

export interface ListingRecord {
  id: string;
  itemId: string;
  sku: string;
  offerId?: string;
  ebayListingId?: string;
  title: string;
  price: number;
  currency: string;
  publishedAt?: string;
  status: ListingStatus;
}

interface ListingRow {
  id: string;
  item_id: string;
  sku: string;
  offer_id: string | null;
  ebay_listing_id: string | null;
  title: string;
  price: number;
  currency: string;
  published_at: string | null;
  status: ListingStatus;
}

function rowToRecord(row: ListingRow): ListingRecord {
  return {
    id: row.id,
    itemId: row.item_id,
    sku: row.sku,
    offerId: row.offer_id ?? undefined,
    ebayListingId: row.ebay_listing_id ?? undefined,
    title: row.title,
    price: row.price,
    currency: row.currency,
    publishedAt: row.published_at ?? undefined,
    status: row.status,
  };
}

export function createListing(input: Omit<ListingRecord, "id" | "status"> & { status?: ListingStatus }): ListingRecord {
  const record: ListingRecord = { id: randomUUID(), status: "draft", ...input };
  getDb()
    .prepare(
      `INSERT INTO listings (id, item_id, sku, offer_id, ebay_listing_id, title, price, currency, published_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.itemId,
      record.sku,
      record.offerId ?? null,
      record.ebayListingId ?? null,
      record.title,
      record.price,
      record.currency,
      record.publishedAt ?? null,
      record.status,
    );
  return record;
}

export function updateListing(id: string, patch: Partial<ListingRecord>): void {
  const current = getListing(id);
  if (!current) throw new Error(`Annonce introuvable: ${id}`);
  const merged = { ...current, ...patch };
  getDb()
    .prepare(
      `UPDATE listings SET offer_id = ?, ebay_listing_id = ?, title = ?, price = ?, currency = ?, published_at = ?, status = ? WHERE id = ?`,
    )
    .run(
      merged.offerId ?? null,
      merged.ebayListingId ?? null,
      merged.title,
      merged.price,
      merged.currency,
      merged.publishedAt ?? null,
      merged.status,
      id,
    );
}

export function getListing(id: string): ListingRecord | undefined {
  const row = getDb().prepare(`SELECT * FROM listings WHERE id = ?`).get(id) as ListingRow | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function listActiveListings(): ListingRecord[] {
  const rows = getDb().prepare(`SELECT * FROM listings WHERE status = 'active'`).all() as ListingRow[];
  return rows.map(rowToRecord);
}
