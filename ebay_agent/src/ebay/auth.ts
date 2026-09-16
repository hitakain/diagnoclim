import axios from "axios";
import { apiBaseUrl, authBaseUrl, identityBaseUrl, loadEbayConfig } from "./config.js";
import { createLogger } from "../utils/logger.js";

const logger = createLogger("ebay-auth");

const APP_SCOPE = "https://api.ebay.com/oauth/api_scope";
const USER_SCOPES = [
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
].join(" ");

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let appToken: CachedToken | undefined;
let userToken: CachedToken | undefined;

function basicAuthHeader(): string {
  const { clientId, clientSecret } = loadEbayConfig();
  if (!clientId || !clientSecret) {
    throw new Error(
      "EBAY_CLIENT_ID / EBAY_CLIENT_SECRET manquants. Cree un compte gratuit sur developer.ebay.com et renseigne .env",
    );
  }
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

/** Jeton applicatif (gratuit, sans consentement utilisateur) pour Browse/Taxonomy. */
export async function getApplicationToken(): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 30_000) return appToken.accessToken;
  const config = loadEbayConfig();
  const body = new URLSearchParams({ grant_type: "client_credentials", scope: APP_SCOPE });
  const { data } = await axios.post(identityBaseUrl(config.env), body, {
    headers: {
      Authorization: `Basic ${basicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  appToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return appToken.accessToken;
}

/** Jeton utilisateur (Sell APIs) rafraichi a partir du refresh_token stocke localement. */
export async function getUserAccessToken(): Promise<string> {
  if (userToken && userToken.expiresAt > Date.now() + 30_000) return userToken.accessToken;
  const config = loadEbayConfig();
  if (!config.refreshToken) {
    throw new Error(
      "Aucun EBAY_REFRESH_TOKEN. Lance `ebay-agent init` une fois pour autoriser l'agent sur ton compte eBay.",
    );
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: config.refreshToken,
    scope: USER_SCOPES,
  });
  const { data } = await axios.post(identityBaseUrl(config.env), body, {
    headers: {
      Authorization: `Basic ${basicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  userToken = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return userToken.accessToken;
}

/** URL de consentement a ouvrir une seule fois dans un navigateur (installation initiale). */
export function buildConsentUrl(): string {
  const config = loadEbayConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.ruName,
    response_type: "code",
    scope: USER_SCOPES,
  });
  return `${authBaseUrl(config.env)}/oauth2/authorize?${params.toString()}`;
}

/** Echange le code d'autorisation (recupere depuis l'URL de redirection) contre un refresh_token durable. */
export async function exchangeAuthorizationCode(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const config = loadEbayConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.ruName,
  });
  const { data } = await axios.post(identityBaseUrl(config.env), body, {
    headers: {
      Authorization: `Basic ${basicAuthHeader()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  logger.info("Jeton utilisateur eBay obtenu, refresh_token a sauvegarder dans .env");
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in };
}

export function ebayApiBase(): string {
  return apiBaseUrl(loadEbayConfig().env);
}
