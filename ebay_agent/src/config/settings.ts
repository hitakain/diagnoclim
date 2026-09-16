import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { ensureAgentHome, SETTINGS_PATH } from "../utils/paths.js";
import { AgentSettings, DEFAULT_SETTINGS } from "./types.js";

function deepMerge<T extends object>(base: T, patch: Partial<T>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(patch)) {
    const patchValue = (patch as Record<string, unknown>)[key];
    const baseValue = (base as Record<string, unknown>)[key];
    const bothObjects =
      patchValue !== null &&
      baseValue !== null &&
      typeof patchValue === "object" &&
      typeof baseValue === "object" &&
      !Array.isArray(patchValue);
    if (bothObjects) {
      result[key] = deepMerge(baseValue as Record<string, unknown>, patchValue as Record<string, unknown>);
    } else if (patchValue !== undefined) {
      result[key] = patchValue;
    }
  }
  return result as T;
}

export function loadSettings(): AgentSettings {
  ensureAgentHome();
  if (!existsSync(SETTINGS_PATH)) {
    saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  const raw = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")) as Partial<AgentSettings>;
  return deepMerge(DEFAULT_SETTINGS, raw);
}

export function saveSettings(settings: AgentSettings): void {
  ensureAgentHome();
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

export function updateSettings(patch: Partial<AgentSettings>): AgentSettings {
  const current = loadSettings();
  const updated = deepMerge(current, patch);
  saveSettings(updated);
  return updated;
}
