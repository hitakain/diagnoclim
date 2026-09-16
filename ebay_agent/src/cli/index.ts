#!/usr/bin/env node
import { Command } from "commander";
import { runInit } from "./init.js";
import { watchInbox } from "./watch.js";
import { listReviews, resolveReviewEntry } from "./review.js";
import { showConfig, setConfigValue } from "./config.js";
import { runSellPipeline } from "../pipeline/orchestrator.js";
import { startMonitorScheduler, runMonitoringPass } from "../monitor/scheduler.js";
import { INBOX_DIR } from "../utils/paths.js";

const program = new Command();
program.name("ebay-agent").description("Agent local-first : photo -> annonce eBay publiee automatiquement");

program
  .command("init")
  .description("Autorise l'agent sur ton compte eBay (une seule fois)")
  .action(async () => {
    await runInit();
  });

program
  .command("sell <photosFolder>")
  .description("Traite un dossier de photos et publie l'annonce si la confiance est suffisante")
  .action(async (photosFolder: string) => {
    const result = await runSellPipeline(photosFolder, (event) => console.log(`-> ${event.message}`));
    if (result.status === "published") {
      console.log(`\nAnnonce publiee sur eBay ✓ (${result.price} €, ID ${result.ebayListingId})`);
    } else {
      console.log(`\nEn attente de validation : ${result.question}`);
    }
  });

program
  .command("watch [inboxFolder]")
  .description("Surveille un dossier : chaque sous-dossier depose = un objet traite automatiquement")
  .action((inboxFolder?: string) => {
    watchInbox(inboxFolder ?? INBOX_DIR);
  });

program
  .command("monitor")
  .description("Demarre la surveillance des annonces actives (repricing automatique)")
  .option("--once", "Execute une seule passe puis quitte")
  .action(async (options: { once?: boolean }) => {
    if (options.once) {
      await runMonitoringPass();
      return;
    }
    startMonitorScheduler();
    console.log("Scheduler de surveillance demarre. Laisse ce processus tourner (ex: via pm2, systemd, launchd).");
  });

const review = program.command("review").description("Gerer les objets en attente de validation manuelle");
review
  .command("list")
  .description("Liste les validations en attente")
  .action(() => listReviews());
review
  .command("resolve <id>")
  .description("Marque une validation comme traitee")
  .action((id: string) => resolveReviewEntry(id));

const config = program.command("config").description("Consulter/modifier les reglages locaux");
config
  .command("show")
  .description("Affiche les reglages actuels")
  .action(() => showConfig());
config
  .command("set <path> <value>")
  .description("Modifie un reglage (ex: autoPublish.enabled true)")
  .action((path: string, value: string) => setConfigValue(path, value));

program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
