import chokidar from "chokidar";
import { dirname, join } from "node:path";
import { mkdirSync, renameSync } from "node:fs";
import { runSellPipeline } from "../pipeline/orchestrator.js";
import { ARCHIVE_DIR } from "../utils/paths.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("watch");
const DEBOUNCE_MS = 4000;

/**
 * Surveille un dossier "boite de reception" : chaque sous-dossier depose = un objet a vendre.
 * Des que plus aucune photo n'arrive pendant quelques secondes, le pipeline complet se lance
 * automatiquement (photo -> vente), sans autre action de l'utilisateur.
 */
export function watchInbox(inboxDir: string): void {
  mkdirSync(inboxDir, { recursive: true });
  logger.info(`Surveillance du dossier ${inboxDir}. Depose un sous-dossier de photos par objet.`);

  const timers = new Map<string, NodeJS.Timeout>();
  const processed = new Set<string>();

  const watcher = chokidar.watch(inboxDir, { ignoreInitial: false, depth: 2 });

  watcher.on("add", (filePath) => {
    const relative = filePath.slice(inboxDir.length).replace(/^[/\\]/, "");
    const [folderName] = relative.split(/[/\\]/);
    if (!folderName) return;
    const folderPath = join(inboxDir, folderName);
    if (processed.has(folderPath)) return;

    const existingTimer = timers.get(folderPath);
    if (existingTimer) clearTimeout(existingTimer);

    timers.set(
      folderPath,
      setTimeout(() => {
        timers.delete(folderPath);
        processed.add(folderPath);
        processFolder(folderPath).catch((error) => logger.error(`Echec du traitement de ${folderPath}`, error));
      }, DEBOUNCE_MS),
    );
  });
}

async function processFolder(folderPath: string): Promise<void> {
  const folderName = folderPath.split(/[/\\]/).pop() ?? "objet";
  console.log(`\n=== Nouvel objet detecte : ${folderName} ===`);
  const result = await runSellPipeline(folderPath, (event) => console.log(`  -> ${event.message}`));

  if (result.status === "published") {
    console.log(`Annonce publiee sur eBay ✓ (${result.price} €, ID ${result.ebayListingId})`);
  } else {
    console.log(`En attente de validation : ${result.question}`);
  }

  const archiveTarget = join(ARCHIVE_DIR, `${Date.now()}-${folderName}`);
  mkdirSync(dirname(archiveTarget), { recursive: true });
  renameSync(folderPath, archiveTarget);
}
