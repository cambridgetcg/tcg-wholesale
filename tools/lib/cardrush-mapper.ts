// Map raw CardRush products to wholesale card format
// Filters, deduplicates, generates SKUs, and calculates GBP pricing

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
// e.g. OP01-001 → OP-OP01-001-JP
function generateBaseSku(cardNumber: string): string {
  const prefix = cardNumber.match(/^(OP|ST|EB|PRB)/)?.[1] ?? "OP";
  return `${prefix}-${cardNumber}-JP`;
}

export function mapToWholesale(
  rawProducts: RawProduct[],
  setCode: string,
  gbpJpyRate: number
): WholesaleCard[] {
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
  // Standard cards: dedup to one SKU per card number (lowest price)
  // Parallel cards: each variant gets its own SKU (P1, P2, ...)
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
    const pricing = calculatePrice(p.priceJpy, gbpJpyRate);

    wholesale.push({
      cardNumber: cardNum,
      sku: baseSku,
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

  // Step 3b: Parallel cards — each unique listing gets P1, P2, ... sorted by price
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

    // Sort by price ascending and assign P1, P2, ...
    const variants = [...seen.values()].sort((a, b) => a.priceJpy - b.priceJpy);
    const baseSku = generateBaseSku(cardNum);

    for (let i = 0; i < variants.length; i++) {
      const p = variants[i];
      const sku = `${baseSku}-P${i + 1}`;
      // cardrushJpy is tax-inclusive (税込) — this is our actual cost
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
