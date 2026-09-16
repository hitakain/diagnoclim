import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildConsentUrl, exchangeAuthorizationCode } from "../ebay/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, "..", "..", ".env");

function upsertEnvVar(name: string, value: string): void {
  const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8") : "";
  const lines = existing.split("\n").filter((line) => line.trim().length > 0);
  const pattern = new RegExp(`^${name}=`);
  const index = lines.findIndex((line) => pattern.test(line));
  const newLine = `${name}=${value}`;
  if (index >= 0) lines[index] = newLine;
  else lines.push(newLine);
  writeFileSync(ENV_PATH, lines.join("\n") + "\n", "utf-8");
}

export async function runInit(): Promise<void> {
  console.log("Autorisation initiale eBay (une seule fois).");
  console.log("Ouvre cette URL dans ton navigateur, connecte-toi et accepte l'acces :\n");
  console.log(buildConsentUrl());
  console.log(
    "\nUne fois redirige, copie la valeur du parametre 'code' present dans l'URL de retour (elle peut etre longue).",
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("\nCode d'autorisation : ")).trim();
  rl.close();

  const decodedCode = decodeURIComponent(code);
  const { refreshToken } = await exchangeAuthorizationCode(decodedCode);
  upsertEnvVar("EBAY_REFRESH_TOKEN", refreshToken);
  console.log("\nRefresh token enregistre dans ebay_agent/.env. L'agent peut maintenant publier sans reconnexion.");
}
