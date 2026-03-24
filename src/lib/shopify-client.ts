/**
 * Shopify REST API client for product/inventory management.
 *
 * Rate limit: 2 req/s (Shopify standard plan: burst 40, steady 2/s).
 * We enforce 500ms between requests.
 */

const SHOPIFY_API_VERSION = "2024-10";

export interface ShopifyProduct {
  productId: string;
  variantId: string;
  inventoryItemId: string;
}

export interface CardForShopify {
  sku: string;
  cardNumber: string;
  name: string;
  nameEn: string | null;
  setCode: string | null;
  setName: string | null;
  rarity: string | null;
  price: number;
  imageUrl: string | null;
  stock: number;
}

/** Minimum delay between API requests (ms) */
const REQUEST_DELAY_MS = 500;

export class ShopifyClient {
  private store: string;
  private accessToken: string;
  private baseUrl: string;

  constructor(store?: string, accessToken?: string) {
    this.store = store ?? process.env.SHOPIFY_STORE ?? "";
    this.accessToken = accessToken ?? process.env.SHOPIFY_ACCESS_TOKEN ?? "";

    if (!this.store) throw new Error("SHOPIFY_STORE is required");
    if (!this.accessToken) throw new Error("SHOPIFY_ACCESS_TOKEN is required");

    this.baseUrl = `https://${this.store}/admin/api/${SHOPIFY_API_VERSION}`;
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ data: T; headers: Headers }> {
    const url = `${this.baseUrl}/${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": this.accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Shopify ${method} ${path} → ${res.status} ${res.statusText}: ${text}`
      );
    }

    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Fetch all products from the store and return a Map keyed by SKU.
   * Handles cursor-based pagination automatically.
   */
  async getAllProductsBySku(): Promise<Map<string, ShopifyProduct>> {
    const skuMap = new Map<string, ShopifyProduct>();
    let nextUrl: string | null =
      `${this.baseUrl}/products.json?limit=250&fields=id,variants`;

    while (nextUrl) {
      const res = await fetch(nextUrl, {
        headers: {
          "X-Shopify-Access-Token": this.accessToken,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(
          `Shopify GET products → ${res.status} ${res.statusText}: ${text}`
        );
      }

      const data = (await res.json()) as {
        products: Array<{
          id: number;
          variants: Array<{
            id: number;
            sku: string;
            inventory_item_id: number;
          }>;
        }>;
      };

      for (const product of data.products) {
        for (const variant of product.variants) {
          const sku = variant.sku?.trim();
          if (sku) {
            skuMap.set(sku, {
              productId: String(product.id),
              variantId: String(variant.id),
              inventoryItemId: String(variant.inventory_item_id),
            });
          }
        }
      }

      // Parse Link header for next page
      const linkHeader = res.headers.get("Link") ?? "";
      nextUrl = parseLinkNext(linkHeader);

      if (nextUrl) {
        await this.sleep(REQUEST_DELAY_MS);
      }
    }

    return skuMap;
  }

  /**
   * Create a new product in Shopify.
   * Returns the product/variant/inventory IDs.
   */
  async createProduct(card: CardForShopify): Promise<ShopifyProduct> {
    const title = `${card.cardNumber} ${card.nameEn ?? card.name} Japanese`.trim();
    const setName = card.setName ?? card.setCode ?? "Unknown Set";

    const tags = [
      "one-piece",
      "japanese",
      card.setCode ?? "",
      card.rarity ?? "",
    ].filter(Boolean);

    const productBody: Record<string, unknown> = {
      title,
      body_html: `<p>Japanese One Piece TCG card. Condition: Near Mint.</p><p>Set: ${setName}</p>`,
      vendor: "Cambridge TCG",
      product_type: "Trading Card",
      tags,
      status: card.stock > 0 ? "active" : "draft",
      variants: [
        {
          sku: card.sku,
          price: card.price.toFixed(2),
          inventory_management: "shopify",
          inventory_policy: "deny",
          fulfillment_service: "manual",
        },
      ],
    };

    // Only add image if we have a URL
    if (card.imageUrl) {
      productBody.images = [{ src: card.imageUrl }];
    }

    const { data } = await this.request<{
      product: {
        id: number;
        variants: Array<{
          id: number;
          inventory_item_id: number;
        }>;
      };
    }>("POST", "products.json", { product: productBody });

    const product = data.product;
    const variant = product.variants[0];

    return {
      productId: String(product.id),
      variantId: String(variant.id),
      inventoryItemId: String(variant.inventory_item_id),
    };
  }

  /**
   * Update the price of a specific variant.
   */
  async updatePrice(variantId: string, price: number): Promise<void> {
    await this.request("PUT", `variants/${variantId}.json`, {
      variant: {
        id: variantId,
        price: price.toFixed(2),
      },
    });
  }

  /**
   * Set the inventory level for an inventory item at a location.
   */
  async updateInventory(
    inventoryItemId: string,
    locationId: string,
    quantity: number
  ): Promise<void> {
    await this.request("POST", "inventory_levels/set.json", {
      inventory_item_id: inventoryItemId,
      location_id: locationId,
      available: quantity,
    });
  }

  /**
   * Set a product's published status (active = published, draft = hidden).
   */
  async setProductStatus(
    productId: string,
    status: "active" | "draft"
  ): Promise<void> {
    await this.request("PUT", `products/${productId}.json`, {
      product: {
        id: productId,
        status,
      },
    });
  }

  /**
   * Get the store's primary location ID (used for inventory updates).
   * Cached after first call.
   */
  private _locationId: string | null = null;

  async getLocationId(): Promise<string> {
    if (this._locationId) return this._locationId;

    const { data } = await this.request<{
      locations: Array<{ id: number; name: string; active: boolean }>;
    }>("GET", "locations.json");

    const active = data.locations.filter((l) => l.active);
    if (active.length === 0) {
      throw new Error("No active Shopify locations found");
    }

    // Use "Shop location" if present, otherwise first active location
    const shop = active.find((l) => l.name === "Shop location") ?? active[0];
    this._locationId = String(shop.id);
    return this._locationId;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLinkNext(linkHeader: string): string | null {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(",")) {
    const [urlPart, relPart] = part.trim().split(";");
    if (relPart?.trim() === 'rel="next"') {
      return urlPart.trim().replace(/^<|>$/g, "");
    }
  }

  return null;
}
