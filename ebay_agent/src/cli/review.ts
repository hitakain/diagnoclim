import { listPendingReviews, resolveReview } from "../db/repositories/reviewQueue.js";
import { getItem } from "../db/repositories/items.js";

export function listReviews(): void {
  const pending = listPendingReviews();
  if (pending.length === 0) {
    console.log("Aucune validation en attente.");
    return;
  }
  for (const entry of pending) {
    const item = getItem(entry.itemId);
    console.log(`\n[${entry.id}] Objet ${entry.itemId} (${item?.photosDir ?? "?"})`);
    console.log(`  ${entry.question}`);
  }
}

export function resolveReviewEntry(id: string): void {
  resolveReview(id);
  console.log(`Validation ${id} marquee comme resolue.`);
}
