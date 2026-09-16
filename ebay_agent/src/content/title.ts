import type { Identification } from "../vision/identify.js";
import { conditionLabel } from "./condition.js";

const EBAY_TITLE_MAX_LENGTH = 80;

export function generateTitle(identification: Identification, categoryName: string | undefined, condition: string): string {
  const identifyingParts = [identification.brand, identification.model, categoryName, ...identification.keywords.slice(0, 3)].filter(
    (part): part is string => Boolean(part && part.trim().length > 0),
  );

  if (identifyingParts.length === 0) {
    return "Article a identifier";
  }

  const parts = [...identifyingParts, conditionLabel(condition)];
  const seen = new Set<string>();
  const deduped = parts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let title = deduped.join(" ").replace(/\s+/g, " ").trim();
  if (title.length > EBAY_TITLE_MAX_LENGTH) {
    title = title.slice(0, EBAY_TITLE_MAX_LENGTH);
    const lastSpace = title.lastIndexOf(" ");
    if (lastSpace > EBAY_TITLE_MAX_LENGTH * 0.6) title = title.slice(0, lastSpace);
  }
  return title || "Article a identifier";
}
