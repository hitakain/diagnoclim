export interface AutoPublishSettings {
  enabled: boolean;
  minIdentificationConfidence: number;
  minPrice: number;
  blockedCategoryIds: string[];
  categoriesRequiringReview: string[];
  requireReviewIfMissingRequiredAspect: boolean;
}

export interface SellerSettings {
  marketplaceId: string;
  merchantLocationKey: string;
  defaultCondition: string;
  defaultConditionByCategory: Record<string, string>;
  shippingPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
  handlingTimeDays: number;
}

export interface PricingSettings {
  strategy: "median" | "trimmedMean" | "min";
  undercutPercent: number;
  marginPercent: number;
  repriceEveryHours: number;
  stopAdjustingAfterDays: number;
  minComparableSample: number;
  maxPriceDropPercentPerAdjustment: number;
  maxTotalPriceDropPercent: number;
}

export interface LearningSettings {
  enabled: boolean;
}

export interface AgentSettings {
  autoPublish: AutoPublishSettings;
  seller: SellerSettings;
  pricing: PricingSettings;
  learning: LearningSettings;
}

export const DEFAULT_SETTINGS: AgentSettings = {
  autoPublish: {
    enabled: false,
    minIdentificationConfidence: 90,
    minPrice: 5,
    blockedCategoryIds: [],
    categoriesRequiringReview: [],
    requireReviewIfMissingRequiredAspect: true,
  },
  seller: {
    marketplaceId: "EBAY_FR",
    merchantLocationKey: "",
    defaultCondition: "USED_GOOD",
    defaultConditionByCategory: {},
    shippingPolicyId: "",
    paymentPolicyId: "",
    returnPolicyId: "",
    handlingTimeDays: 2,
  },
  pricing: {
    strategy: "median",
    undercutPercent: 5,
    marginPercent: 0,
    repriceEveryHours: 24,
    stopAdjustingAfterDays: 30,
    minComparableSample: 3,
    maxPriceDropPercentPerAdjustment: 10,
    maxTotalPriceDropPercent: 30,
  },
  learning: {
    enabled: true,
  },
};
