import inventoryData from "../data/inventory.json";
import ordersData from "../data/orders.json";
import productsData from "../data/products.json";
import type { VtexClient, VtexInventory, VtexOrder, VtexProduct } from "./vtex-types";

const products = productsData as VtexProduct[];
const inventory = inventoryData as VtexInventory[];
const orders = ordersData as VtexOrder[];

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const offerOf = (product: VtexProduct) => product.items[0]!.sellers[0]!.commertialOffer;

/** A product matches when every word of the query is in its searchable text. Simple on purpose: search quality was module 6. */
function matches(product: VtexProduct, words: string[]) {
  const text = normalize(`${product.productName} ${product.brand} ${product.categories.join(" ")} ${product.description}`);
  return words.every((word) => text.includes(word));
}

/** The store in memory, answering in the shapes of the real APIs. */
export const simulatedVtex: VtexClient = {
  async searchProducts({ query, maxPrice, inStockOnly, limit }) {
    const words = normalize(query ?? "").split(/\s+/).filter(Boolean);
    return products
      .filter((p) => matches(p, words))
      .filter((p) => maxPrice === undefined || offerOf(p).Price <= maxPrice)
      .filter((p) => !inStockOnly || offerOf(p).IsAvailable)
      .slice(0, limit);
  },
  getProduct: async (productId) => products.find((p) => p.productId === productId) ?? null,
  getInventory: async (skuId) => inventory.find((i) => i.skuId === skuId) ?? null,
  getOrder: async (orderId) => orders.find((o) => o.orderId === orderId) ?? null,
  async listOrders({ email, status, limit }) {
    return orders
      .filter((o) => !email || o.clientProfileData.email.toLowerCase() === email.toLowerCase())
      .filter((o) => !status || o.status === status)
      .sort((a, b) => b.creationDate.localeCompare(a.creationDate))
      .slice(0, limit);
  },
};
