import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

export const AGENT_HOME = process.env.EBAY_AGENT_HOME ?? join(homedir(), ".ebay-agent");
export const SETTINGS_PATH = join(AGENT_HOME, "settings.json");
export const DB_PATH = join(AGENT_HOME, "data.sqlite");
export const INBOX_DIR = join(AGENT_HOME, "inbox");
export const ARCHIVE_DIR = join(AGENT_HOME, "archive");

export function ensureAgentHome(): void {
  for (const dir of [AGENT_HOME, INBOX_DIR, ARCHIVE_DIR]) {
    mkdirSync(dir, { recursive: true });
  }
}
