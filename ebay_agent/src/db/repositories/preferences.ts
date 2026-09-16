import { getDb } from "../db.js";

export function setPreference(key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO preferences (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, JSON.stringify(value), new Date().toISOString());
}

export function getPreference<T>(key: string): T | undefined {
  const row = getDb().prepare(`SELECT value FROM preferences WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row ? (JSON.parse(row.value) as T) : undefined;
}

/**
 * Incrémente un compteur de choix (ex: "condition.used_good" -> 7) pour dégager
 * l'option la plus fréquente au fil des utilisations sans jamais rien envoyer en ligne.
 */
export function bumpChoiceCount(family: string, choice: string): void {
  const key = `choice_counts.${family}`;
  const counts = getPreference<Record<string, number>>(key) ?? {};
  counts[choice] = (counts[choice] ?? 0) + 1;
  setPreference(key, counts);
}

export function getMostFrequentChoice(family: string): string | undefined {
  const counts = getPreference<Record<string, number>>(`choice_counts.${family}`);
  if (!counts) return undefined;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}
