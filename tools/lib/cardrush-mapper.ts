// Map raw CardRush products to wholesale card format
// Filters, deduplicates, generates SKUs, and calculates GBP pricing
//
// SKU assignment uses a global state so that the same card number appearing
// in multiple product groups gets unique P-suffixed SKUs. Sets are scraped
// in product-group-ID order (ascending) so lower IDs claim the base SKU first.

import { RawProduct, isGraded } from "./cardrush-parser";
import { MIN_PRICE_JPY } from "./config";
import { calculatePrice, type PriceBreakdown } from "../../src/lib/pricing";

export interface WholesaleCard {
  cardNumber: string;
  sku: string;
  name: string;
  setCode: string;
  rarity: string | null;
  isParallel: boolean;
  // cardrushJpy is tax-inclusive (税込) — this is our actual cost
  cardrushJpy: number;
  pricing: PriceBreakdown;
  cardrushUrl: string | null;
  imageUrl: string | null;
  stock: number;
}

// ---------------------------------------------------------------------------
// Global SKU state — tracks P-index across all product groups
// ---------------------------------------------------------------------------

export interface SkuTracker {
  baseTaken: boolean;
  nextP: number; // starts at 1
}

export type GlobalSkuState = Map<string, SkuTracker>;

export function createSkuState(): GlobalSkuState {
  return new Map();
}

function assignSku(
  state: GlobalSkuState,
  baseSku: string,
  isParallel: boolean
): string {
  let tracker = state.get(baseSku);
  if (!tracker) {
    tracker = { baseTaken: false, nextP: 1 };
    state.set(baseSku, tracker);
  }

  // Standard cards get the base SKU if it's still available
  if (!isParallel && !tracker.baseTaken) {
    tracker.baseTaken = true;
    return baseSku;
  }

  // Otherwise assign next P number
  const sku = `${baseSku}-P${tracker.nextP}`;
  tracker.nextP++;
  return sku;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Clean display name by stripping metadata markers
function cleanName(raw: string): string {
  return raw
    .replace(/\{[^}]+\}/g, "")          // {OP01-001}
    .replace(/【[^】]+】/g, "")           // 【SR】
    .replace(/〔[^〕]+〕/g, "")           // 〔状態A-〕
    .replace(/パラレル/g, "")             // パラレル
    .replace(/\([^)]*alternate[^)]*\)/gi, "") // (alternate art) variants
    .replace(/\s+/g, " ")
    .trim();
}

// Generate base SKU (without parallel suffix)
// e.g. OP01-001 → OP-OP01-001-JP, P-001 → P-P-001-JP, DON → DON-JP
function generateBaseSku(cardNumber: string): string {
  if (cardNumber === "DON" || cardNumber === "P") {
    return `${cardNumber}-JP`;
  }
  const prefix = cardNumber.match(/^(OP|ST|EB|PRB|P)/)?.[1] ?? "OP";
  return `${prefix}-${cardNumber}-JP`;
}

// ---------------------------------------------------------------------------
// Singles mapper
// ---------------------------------------------------------------------------

export function mapToWholesale(
  rawProducts: RawProduct[],
  setCode: string,
  gbpJpyRate: number,
  skuState?: GlobalSkuState
): WholesaleCard[] {
  const state = skuState ?? createSkuState();

  // Step 1: Filter out unwanted products
  const filtered = rawProducts.filter((p) => {
    if (!p.cardNumber) return false;
    if (p.priceJpy < MIN_PRICE_JPY) return false;
    if (isGraded(p)) return false;
    if (p.stock === 0) return false;
    // 状態 = condition grade (A-, B, C etc.) — these are sub-mint cards
    if (p.condition && p.condition.startsWith("状態")) return false;
    return true;
  });

  // Step 2: Group by card number + parallel flag
  const standardGroups = new Map<string, RawProduct[]>();
  const parallelGroups = new Map<string, RawProduct[]>();

  for (const product of filtered) {
    const cardNum = product.cardNumber!;
    const target = product.isParallel ? parallelGroups : standardGroups;
    const group = target.get(cardNum) ?? [];
    group.push(product);
    target.set(cardNum, group);
  }

  const wholesale: WholesaleCard[] = [];

  // Step 3a: Standard cards — dedup by card number, take lowest price
  for (const [cardNum, group] of standardGroups) {
    group.sort((a, b) => a.priceJpy - b.priceJpy);
    const p = group[0];
    const baseSku = generateBaseSku(cardNum);
    const sku = assignSku(state, baseSku, false);
    const pricing = calculatePrice(p.priceJpy, gbpJpyRate);

    wholesale.push({
      cardNumber: cardNum,
      sku,
      name: cleanName(p.name),
      setCode,
      rarity: p.rarity,
      isParallel: false,
      cardrushJpy: p.priceJpy,
      pricing,
      cardrushUrl: p.productUrl,
      imageUrl: p.imageUrl,
      stock: p.stock,
    });
  }

  // Step 3b: Parallel cards — each unique listing gets next P number, sorted by price
  for (const [cardNum, group] of parallelGroups) {
    // Dedup by name (same art variant may have multiple condition listings)
    const seen = new Map<string, RawProduct>();
    for (const p of group) {
      const key = cleanName(p.name);
      const existing = seen.get(key);
      if (!existing || p.priceJpy < existing.priceJpy) {
        seen.set(key, p);
      }
    }

    // Sort by price ascending
    const variants = [...seen.values()].sort((a, b) => a.priceJpy - b.priceJpy);
    const baseSku = generateBaseSku(cardNum);

    for (const p of variants) {
      const sku = assignSku(state, baseSku, true);
      const pricing = calculatePrice(p.priceJpy, gbpJpyRate);

      wholesale.push({
        cardNumber: cardNum,
        sku,
        name: cleanName(p.name),
        setCode,
        rarity: p.rarity,
        isParallel: true,
        cardrushJpy: p.priceJpy,
        pricing,
        cardrushUrl: p.productUrl,
        imageUrl: p.imageUrl,
        stock: p.stock,
      });
    }
  }

  // Sort by SKU for consistent output
  wholesale.sort((a, b) => a.sku.localeCompare(b.sku));

  return wholesale;
}

// ---------------------------------------------------------------------------
// Sealed product mapper (booster boxes, starter decks, collections)
// ---------------------------------------------------------------------------

// Extract CardRush product ID from URL (e.g. /product/9816 → 9816)
function extractProductId(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/product\/(\d+)/);
  return match ? match[1] : null;
}

// Clean sealed product name — strip condition markers but keep identifiers
function cleanSealedName(raw: string): string {
  return raw
    .replace(/\{[^}]*\}/g, "")          // {-} or any tag
    .replace(/〔[^〕]+〕/g, "")           // 〔状態A-〕
    .replace(/【[^】]+】/g, "")           // 【未開封BOX】
    .replace(/\(A-\)/g, "")             // (A-) condition
    .replace(/\s+/g, " ")
    .trim();
}

// Check if a sealed product name indicates sub-mint condition
function isSealedSubMint(name: string): boolean {
  return /\(A-\)/.test(name) || /〔状態/.test(name);
}

export function mapSealedToWholesale(
  rawProducts: RawProduct[],
  gbpJpyRate: number
): WholesaleCard[] {
  // Step 1: Filter out unwanted products
  const filtered = rawProducts.filter((p) => {
    if (p.priceJpy <= 0) return false;
    if (p.stock === 0) return false;
    if (isSealedSubMint(p.name)) return false;
    if (isGraded(p)) return false;
    if (/英語版/.test(p.name)) return false;
    return true;
  });

  // Step 2: Dedup by cleaned name — take lowest price for same product
  const byName = new Map<string, RawProduct>();
  for (const p of filtered) {
    const key = cleanSealedName(p.name);
    const existing = byName.get(key);
    if (!existing || p.priceJpy < existing.priceJpy) {
      byName.set(key, p);
    }
  }

  // Step 3: Map to wholesale format
  const wholesale: WholesaleCard[] = [];
  for (const [, p] of byName) {
    const productId = extractProductId(p.productUrl);
    if (!productId) continue;

    const sku = `SEALED-${productId}-JP`;
    const pricing = calculatePrice(p.priceJpy, gbpJpyRate);

    wholesale.push({
      cardNumber: `SEALED-${productId}`,
      sku,
      name: cleanSealedName(p.name),
      setCode: "SEALED",
      rarity: null,
      isParallel: false,
      cardrushJpy: p.priceJpy,
      pricing,
      cardrushUrl: p.productUrl,
      imageUrl: p.imageUrl,
      stock: p.stock,
    });
  }

  wholesale.sort((a, b) => a.cardrushJpy - b.cardrushJpy);
  return wholesale;
}
