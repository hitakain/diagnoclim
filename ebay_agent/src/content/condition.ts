export const CONDITION_LABELS_FR: Record<string, string> = {
  NEW: "Neuf",
  NEW_OTHER: "Neuf autre",
  USED_EXCELLENT: "Etat excellent",
  USED_VERY_GOOD: "Tres bon etat",
  USED_GOOD: "Bon etat",
  USED_ACCEPTABLE: "Etat correct",
  FOR_PARTS_OR_NOT_WORKING: "Pour pieces / ne fonctionne pas",
};

export function conditionLabel(condition: string): string {
  return CONDITION_LABELS_FR[condition] ?? condition;
}
