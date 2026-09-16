import { loadSettings, saveSettings } from "../config/settings.js";

export function showConfig(): void {
  console.log(JSON.stringify(loadSettings(), null, 2));
}

function setPath(target: Record<string, unknown>, path: string[], value: unknown): void {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  if (typeof target[head] !== "object" || target[head] === null) {
    target[head] = {};
  }
  setPath(target[head] as Record<string, unknown>, rest, value);
}

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setConfigValue(dottedPath: string, rawValue: string): void {
  const settings = loadSettings() as unknown as Record<string, unknown>;
  setPath(settings, dottedPath.split("."), parseValue(rawValue));
  saveSettings(settings as unknown as ReturnType<typeof loadSettings>);
  console.log(`${dottedPath} = ${rawValue}`);
}
