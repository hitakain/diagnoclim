import "dotenv/config";

export type EbayEnv = "production" | "sandbox";

export interface EbayConfig {
  env: EbayEnv;
  clientId: string;
  clientSecret: string;
  ruName: string;
  marketplaceId: string;
  refreshToken?: string;
  merchantLocationKey: string;
}

export function loadEbayConfig(): EbayConfig {
  const env = (process.env.EBAY_ENV as EbayEnv) ?? "production";
  return {
    env,
    clientId: process.env.EBAY_CLIENT_ID ?? "",
    clientSecret: process.env.EBAY_CLIENT_SECRET ?? "",
    ruName: process.env.EBAY_RU_NAME ?? "",
    marketplaceId: process.env.EBAY_MARKETPLACE_ID ?? "EBAY_FR",
    refreshToken: process.env.EBAY_REFRESH_TOKEN || undefined,
    merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY ?? "",
  };
}

export function apiBaseUrl(env: EbayEnv): string {
  return env === "sandbox" ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

export function authBaseUrl(env: EbayEnv): string {
  return env === "sandbox" ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";
}

export function identityBaseUrl(env: EbayEnv): string {
  return env === "sandbox"
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token";
}
