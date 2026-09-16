import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";

export interface ReviewQueueEntry {
  id: string;
  itemId: string;
  question: string;
  createdAt: string;
  resolvedAt?: string;
}

export function enqueueReview(itemId: string, question: string): ReviewQueueEntry {
  const entry: ReviewQueueEntry = { id: randomUUID(), itemId, question, createdAt: new Date().toISOString() };
  getDb()
    .prepare(`INSERT INTO review_queue (id, item_id, question, created_at) VALUES (?, ?, ?, ?)`)
    .run(entry.id, entry.itemId, entry.question, entry.createdAt);
  return entry;
}

export function resolveReview(id: string): void {
  getDb()
    .prepare(`UPDATE review_queue SET resolved_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), id);
}

interface Row {
  id: string;
  item_id: string;
  question: string;
  created_at: string;
  resolved_at: string | null;
}

export function listPendingReviews(): ReviewQueueEntry[] {
  const rows = getDb()
    .prepare(`SELECT * FROM review_queue WHERE resolved_at IS NULL ORDER BY created_at ASC`)
    .all() as Row[];
  return rows.map((r) => ({
    id: r.id,
    itemId: r.item_id,
    question: r.question,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at ?? undefined,
  }));
}
