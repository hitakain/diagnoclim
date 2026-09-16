type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel: Level = (process.env.EBAY_AGENT_LOG_LEVEL as Level) ?? "info";

function log(level: Level, scope: string, message: string, extra?: unknown): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] [${scope}] ${message}`;
  const out = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  out(line, extra ?? "");
}

export function createLogger(scope: string) {
  return {
    debug: (message: string, extra?: unknown) => log("debug", scope, message, extra),
    info: (message: string, extra?: unknown) => log("info", scope, message, extra),
    warn: (message: string, extra?: unknown) => log("warn", scope, message, extra),
    error: (message: string, extra?: unknown) => log("error", scope, message, extra),
  };
}
