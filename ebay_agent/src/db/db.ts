import { DatabaseSync } from "node:sqlite";
import { ensureAgentHome, DB_PATH } from "../utils/paths.js";
import { SCHEMA_SQL } from "./schema.js";

let db: DatabaseSync | undefined;

export function getDb(): DatabaseSync {
  if (db) return db;
  ensureAgentHome();
  db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA_SQL);
  return db;
}
