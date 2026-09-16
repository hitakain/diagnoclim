import type { AutoPublishSettings } from "../config/types.js";

export interface ListingDraft {
  title: string;
  categoryId: string;
  price: number | null;
  identificationConfidence: number;
  missingRequiredAspects: string[];
}

export interface Decision {
  action: "publish" | "review";
  reason: string;
  question?: string;
}

/**
 * Applique les garde-fous configures par l'utilisateur avant toute publication automatique.
 * Ne pose une question que lorsque la decision ne peut vraiment pas etre prise automatiquement.
 */
export function evaluateAutoPublish(draft: ListingDraft, settings: AutoPublishSettings): Decision {
  if (!settings.enabled) {
    return { action: "review", reason: "publication automatique desactivee dans les reglages" };
  }

  if (settings.blockedCategoryIds.includes(draft.categoryId)) {
    return { action: "review", reason: `categorie ${draft.categoryId} bloquee pour la publication automatique` };
  }

  if (settings.categoriesRequiringReview.includes(draft.categoryId)) {
    return { action: "review", reason: `categorie ${draft.categoryId} configuree pour validation obligatoire` };
  }

  if (draft.price === null) {
    return {
      action: "review",
      reason: "prix indetermine (pas assez de comparables sur eBay)",
      question:
        "Je n'ai pas trouve assez d'annonces comparables pour fixer un prix fiable. " +
        "Peux-tu confirmer un prix ou preciser la reference exacte du produit ?",
    };
  }

  if (draft.price < settings.minPrice) {
    return {
      action: "review",
      reason: `prix estime (${draft.price} €) sous le seuil minimum configure (${settings.minPrice} €)`,
      question: `Le prix estime (${draft.price} €) est sous ton seuil minimum (${settings.minPrice} €). Je publie quand meme, je baisse le seuil, ou tu gardes l'objet ?`,
    };
  }

  if (settings.requireReviewIfMissingRequiredAspect && draft.missingRequiredAspects.length > 0) {
    return {
      action: "review",
      reason: `caracteristiques obligatoires manquantes : ${draft.missingRequiredAspects.join(", ")}`,
      question: `Il manque des informations obligatoires pour cette categorie eBay (${draft.missingRequiredAspects.join(", ")}). Peux-tu les preciser ?`,
    };
  }

  if (draft.identificationConfidence < settings.minIdentificationConfidence) {
    return {
      action: "review",
      reason: `confiance d'identification trop faible (${draft.identificationConfidence}% < ${settings.minIdentificationConfidence}%)`,
      question: `Je ne suis sur qu'a ${draft.identificationConfidence}% de l'identification de "${draft.title}". Peux-tu prendre une photo plus nette de l'etiquette/reference ?`,
    };
  }

  return {
    action: "publish",
    reason: `confiance ${draft.identificationConfidence}% >= seuil ${settings.minIdentificationConfidence}%, prix ${draft.price} € >= minimum ${settings.minPrice} €`,
  };
}
