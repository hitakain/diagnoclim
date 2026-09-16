import { getDb } from "../db.js";

export interface PriceHistoryEntry {
  listingId: string;
  price: number;
  reason: string;
  createdAt: string;
}

export function recordPriceChange(entry: Omit<PriceHistoryEntry, "createdAt">): void {
  getDb()
    .prepare(`INSERT INTO price_history (listing_id, price, reason, created_at) VALUES (?, ?, ?, ?)`)
    .run(entry.listingId, entry.price, entry.reason, new Date().toISOString());
}

interface Row {
  listing_id: string;
  price: number;
  reason: string;
  created_at: string;
}

export function getPriceHistory(listingId: string): PriceHistoryEntry[] {
  const rows = getDb()
    .prepare(`SELECT * FROM price_history WHERE listing_id = ? ORDER BY created_at ASC`)
    .all(listingId) as Row[];
  return rows.map((r) => ({ listingId: r.listing_id, price: r.price, reason: r.reason, createdAt: r.created_at }));
}
