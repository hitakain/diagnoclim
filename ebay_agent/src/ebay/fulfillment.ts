import { userGet } from "./http.js";

interface LineItem {
  sku: string;
}

interface Order {
  orderId: string;
  lineItems: LineItem[];
  orderFulfillmentStatus: string;
}

interface OrdersResponse {
  orders?: Order[];
}

/**
 * Detecte si un SKU a ete vendu, via l'API Fulfillment (gratuite). Une annonce a quantite 1
 * disparait de l'inventaire actif des qu'une commande est passee dessus.
 */
export async function isSkuSold(sku: string): Promise<boolean> {
  const data = await userGet<OrdersResponse>("/sell/fulfillment/v1/order", { limit: 50 });
  return (data.orders ?? []).some((order) => order.lineItems.some((item) => item.sku === sku));
}
