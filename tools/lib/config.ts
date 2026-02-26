// CardRush scraper configuration
// Product-group IDs verified by scraping cardrush-op.jp homepage (2026-02-26)

export interface SetConfig {
  code: string;
  name: string;
  productGroupId: number;
  gameCode: string;
}

// Verified product-group IDs from cardrush-op.jp
export const SET_CONFIGS: Record<string, SetConfig> = {
  // Main booster sets
  OP01: { code: "OP01", name: "Romance Dawn", productGroupId: 27, gameCode: "onepiece" },
  OP02: { code: "OP02", name: "Paramount War", productGroupId: 28, gameCode: "onepiece" },
  OP03: { code: "OP03", name: "Pillars of Strength", productGroupId: 29, gameCode: "onepiece" },
  OP04: { code: "OP04", name: "Kingdoms of Intrigue", productGroupId: 30, gameCode: "onepiece" },
  OP05: { code: "OP05", name: "Awakening of the New Era", productGroupId: 31, gameCode: "onepiece" },
  OP06: { code: "OP06", name: "Wings of the Captain", productGroupId: 35, gameCode: "onepiece" },
  OP07: { code: "OP07", name: "500 Years in the Future", productGroupId: 41, gameCode: "onepiece" },
  OP08: { code: "OP08", name: "Two Legends", productGroupId: 44, gameCode: "onepiece" },
  OP09: { code: "OP09", name: "The Four Emperors", productGroupId: 53, gameCode: "onepiece" },
  OP10: { code: "OP10", name: "Royal Blood", productGroupId: 54, gameCode: "onepiece" },
  OP11: { code: "OP11", name: "Godspeed Fist", productGroupId: 89, gameCode: "onepiece" },
  OP12: { code: "OP12", name: "Bond of Master and Student", productGroupId: 93, gameCode: "onepiece" },
  OP13: { code: "OP13", name: "Inherited Will", productGroupId: 103, gameCode: "onepiece" },
  OP14: { code: "OP14", name: "Seven Greats of the Azure Sea", productGroupId: 113, gameCode: "onepiece" },
  // Extra boosters
  EB01: { code: "EB01", name: "Memorial Collection", productGroupId: 40, gameCode: "onepiece" },
  EB02: { code: "EB02", name: "Anime 25th Collection", productGroupId: 59, gameCode: "onepiece" },
  EB03: { code: "EB03", name: "Heroines Edition", productGroupId: 112, gameCode: "onepiece" },
  EB04: { code: "EB04", name: "Egghead Crisis", productGroupId: 117, gameCode: "onepiece" },
  // Premium boosters
  PRB01: { code: "PRB01", name: "ONE PIECE CARD THE BEST", productGroupId: 52, gameCode: "onepiece" },
  PRB02: { code: "PRB02", name: "THE BEST vol.2", productGroupId: 102, gameCode: "onepiece" },
  // Starter decks
  ST13: { code: "ST13", name: "Ultimate Deck: Bond of Three Brothers", productGroupId: 39, gameCode: "onepiece" },
  "ST15-20": { code: "ST15-20", name: "Starter Deck 6-Color (2024)", productGroupId: 45, gameCode: "onepiece" },
  ST21: { code: "ST21", name: "Starter Deck EX: Gear 5", productGroupId: 55, gameCode: "onepiece" },
  ST22: { code: "ST22", name: "Starter Deck: Ace & Newgate", productGroupId: 90, gameCode: "onepiece" },
  "ST23-28": { code: "ST23-28", name: "Starter Deck 6-Color (2025)", productGroupId: 95, gameCode: "onepiece" },
};

export const MIN_PRICE_JPY = 280;
export const ITEMS_PER_PAGE = 100;
export const REQUEST_DELAY_MS = 1500;

export const CARDRUSH_BASE_URL = "https://www.cardrush-op.jp";

export function getSetConfig(setCode: string): SetConfig | undefined {
  return SET_CONFIGS[setCode.toUpperCase()];
}

export function getAllSetCodes(): string[] {
  return Object.keys(SET_CONFIGS);
}
