// Parse CardRush product-group HTML into structured product data
// Uses cheerio to extract product listings from server-rendered pages

import * as cheerio from "cheerio";
import { CARDRUSH_BASE_URL } from "./config";

export interface RawProduct {
  cardNumber: string | null;
  name: string;
  priceJpy: number;
  rarity: string | null;
  stock: number;
  condition: string | null;
  isParallel: boolean;
  productUrl: string | null;
  imageUrl: string | null;
}

export interface DiscoveredGroup {
  id: number;
  name: string;
  url: string;
}

// Regex patterns for extracting structured data from product names
const CARD_NUMBER_RE = /\{((?:OP|ST|EB|PRB)\d{2}-\d{3})/;
const PRICE_RE = /([\d,]+)円/;
const RARITY_RE = /【([^】]+)】/;
const STOCK_RE = /在庫数\s*(\d+)枚/;
const CONDITION_RE = /〔([^〕]+)〕/;
const PARALLEL_INDICATORS = ["パラレル", "/P"];
const GRADED_INDICATORS = ["PSA", "BGS", "CGC", "ARS"];

export function parseProductGroupPage(html: string): RawProduct[] {
  const $ = cheerio.load(html);
  const products: RawProduct[] = [];

  // Each product is a <li class="list_item_cell"> inside <ul class="item_list">
  $("li.list_item_cell").each((_, el) => {
    const $el = $(el);
    const product = extractProduct($, $el);
    if (product) {
      products.push(product);
    }
  });

  return products;
}

function extractProduct(
  $: cheerio.CheerioAPI,
  $el: ReturnType<cheerio.CheerioAPI>
): RawProduct | null {
  // Product name from .goods_name span
  const name = $el.find(".goods_name").text().trim();
  if (!name) return null;

  // Price from .selling_price .figure — tax-inclusive (税込)
  const priceText = $el.find(".selling_price .figure").text();
  const priceMatch = priceText.match(PRICE_RE);
  const priceJpy = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ""), 10) : 0;
  if (priceJpy === 0) return null;

  // Card number from product name: {OP01-003}
  const cardNumberMatch = name.match(CARD_NUMBER_RE);
  const cardNumber = cardNumberMatch ? cardNumberMatch[1] : null;

  // Rarity from product name: 【SR】
  const rarityMatch = name.match(RARITY_RE);
  const rarity = rarityMatch ? rarityMatch[1] : null;

  // Stock from .stock element
  const stockText = $el.find(".stock").text();
  const stockMatch = stockText.match(STOCK_RE);
  const stock = stockMatch
    ? parseInt(stockMatch[1], 10)
    : stockText.includes("在庫なし")
      ? 0
      : -1;

  // Condition from product name: 〔状態A-〕
  const conditionMatch = name.match(CONDITION_RE);
  const condition = conditionMatch ? conditionMatch[1] : null;

  // Parallel detection
  const isParallel =
    PARALLEL_INDICATORS.some((p) => name.includes(p)) ||
    (rarity !== null && rarity.includes("P"));

  // Product URL from .item_data_link or first anchor
  const href =
    $el.find(".item_data_link").attr("href") ||
    $el.find("a").first().attr("href");
  const productUrl = href
    ? href.startsWith("http")
      ? href
      : `${CARDRUSH_BASE_URL}${href}`
    : null;

  // Image URL from .global_photo img
  const imgSrc =
    $el.find(".global_photo img").attr("src") ||
    $el.find("img").first().attr("src");
  const imageUrl = imgSrc
    ? imgSrc.startsWith("http")
      ? imgSrc
      : `${CARDRUSH_BASE_URL}${imgSrc}`
    : null;

  return {
    cardNumber,
    name,
    priceJpy,
    rarity,
    stock,
    condition,
    isParallel,
    productUrl,
    imageUrl,
  };
}

export function isGraded(product: RawProduct): boolean {
  return (
    GRADED_INDICATORS.some((g) => (product.condition ?? "").toUpperCase().includes(g)) ||
    GRADED_INDICATORS.some((g) => product.name.toUpperCase().includes(g))
  );
}

export function parseDiscoveryPage(html: string): DiscoveredGroup[] {
  const $ = cheerio.load(html);
  const groups: DiscoveredGroup[] = [];

  // Look for links to product-group pages
  $('a[href*="/product-group/"]').each((_, el) => {
    const href = $(el).attr("href") || "";
    const match = href.match(/\/product-group\/(\d+)/);
    if (match) {
      const id = parseInt(match[1], 10);
      const name = $(el).text().trim();
      if (name && !groups.some((g) => g.id === id)) {
        groups.push({
          id,
          name,
          url: `${CARDRUSH_BASE_URL}/product-group/${id}`,
        });
      }
    }
  });

  return groups.sort((a, b) => a.id - b.id);
}
