import type { Identification } from "../vision/identify.js";
import { conditionLabel } from "./condition.js";

export function generateDescription(
  identification: Identification,
  categoryName: string | undefined,
  condition: string,
): string {
  const lines: string[] = [];

  const productLine = [identification.brand, identification.model, categoryName].filter(Boolean).join(" ");
  lines.push(productLine ? `${productLine}` : "Article vendu en l'etat.");
  lines.push("");
  lines.push(`Etat : ${conditionLabel(condition)}`);

  if (identification.gtin) {
    lines.push(`Reference / code-barres detecte : ${identification.gtin}`);
  }

  if (identification.keywords.length > 0) {
    lines.push(`Elements identifies sur les photos : ${identification.keywords.join(", ")}`);
  }

  lines.push("");
  lines.push(
    "Photos contractuelles. Merci de bien regarder l'ensemble des photos avant achat. " +
      "Envoi soigne sous 2 jours ouvres apres paiement.",
  );

  return lines.join("\n");
}
