import { randomUUID } from "node:crypto";
import { getDb } from "../db.js";
import type { Identification } from "../../vision/identify.js";

export type ItemStatus = "analyzing" | "pending_review" | "ready" | "published" | "sold" | "rejected";

export interface ItemRecord {
  id: string;
  createdAt: string;
  photosDir: string;
  identification?: Identification;
  identificationConfidence?: number;
  condition?: string;
  categoryId?: string;
  status: ItemStatus;
}

export function createItem(photosDir: string): ItemRecord {
  const record: ItemRecord = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    photosDir,
    status: "analyzing",
  };
  getDb()
    .prepare(
      `INSERT INTO items (id, created_at, photos_dir, status) VALUES (?, ?, ?, ?)`,
    )
    .run(record.id, record.createdAt, record.photosDir, record.status);
  return record;
}

export function updateItem(id: string, patch: Partial<ItemRecord>): void {
  const current = getItem(id);
  if (!current) throw new Error(`Item introuvable: ${id}`);
  const merged: ItemRecord = { ...current, ...patch };
  getDb()
    .prepare(
      `UPDATE items SET identification_json = ?, identification_confidence = ?, condition = ?, category_id = ?, status = ? WHERE id = ?`,
    )
    .run(
      merged.identification ? JSON.stringify(merged.identification) : null,
      merged.identificationConfidence ?? null,
      merged.condition ?? null,
      merged.categoryId ?? null,
      merged.status,
      id,
    );
}

interface ItemRow {
  id: string;
  created_at: string;
  photos_dir: string;
  identification_json: string | null;
  identification_confidence: number | null;
  condition: string | null;
  category_id: string | null;
  status: ItemStatus;
}

function rowToRecord(row: ItemRow): ItemRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    photosDir: row.photos_dir,
    identification: row.identification_json ? JSON.parse(row.identification_json) : undefined,
    identificationConfidence: row.identification_confidence ?? undefined,
    condition: row.condition ?? undefined,
    categoryId: row.category_id ?? undefined,
    status: row.status,
  };
}

export function getItem(id: string): ItemRecord | undefined {
  const row = getDb().prepare(`SELECT * FROM items WHERE id = ?`).get(id) as ItemRow | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function listItemsByStatus(status: ItemStatus): ItemRecord[] {
  const rows = getDb().prepare(`SELECT * FROM items WHERE status = ?`).all(status) as ItemRow[];
  return rows.map(rowToRecord);
}
