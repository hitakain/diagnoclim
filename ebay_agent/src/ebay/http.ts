import axios, { AxiosRequestConfig } from "axios";
import { ebayApiBase, getApplicationToken, getUserAccessToken } from "./auth.js";
import { loadEbayConfig } from "./config.js";

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  token: string,
  options: { params?: Record<string, string | number | undefined>; data?: unknown } = {},
): Promise<T> {
  const config: AxiosRequestConfig = {
    method,
    url: `${ebayApiBase()}${path}`,
    params: options.params,
    data: options.data,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-EBAY-C-MARKETPLACE-ID": loadEbayConfig().marketplaceId,
      "Accept-Language": "fr-FR",
      "Content-Language": "fr-FR",
    },
  };
  const { data } = await axios.request<T>(config);
  return data;
}

export async function appGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const token = await getApplicationToken();
  return request<T>("GET", path, token, { params });
}

export async function userGet<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const token = await getUserAccessToken();
  return request<T>("GET", path, token, { params });
}

export async function userPost<T>(path: string, data?: unknown): Promise<T> {
  const token = await getUserAccessToken();
  return request<T>("POST", path, token, { data });
}

export async function userPut<T>(path: string, data?: unknown): Promise<T> {
  const token = await getUserAccessToken();
  return request<T>("PUT", path, token, { data });
}
