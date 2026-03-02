export const VAT_RATE = 0.20;
export const MARGIN_PCT = 0.22;
export const PER_CARD_FEE = 0.22;
export const SEALED_MARGIN_PCT = 0.18;
export const SEALED_FLAT_FEE = 2.20;

export interface PriceBreakdown {
  baseGbp: number;
  priceExVat: number;
}

export function calculatePrice(cardrushJpy: number, gbpJpyRate: number): PriceBreakdown {
  const baseGbp = cardrushJpy / gbpJpyRate;
  const priceExVat = baseGbp * (1 + MARGIN_PCT) + PER_CARD_FEE;

  return {
    baseGbp: round2(baseGbp),
    priceExVat: round2(priceExVat),
  };
}

export function calculateSealedPrice(cardrushJpy: number, gbpJpyRate: number): PriceBreakdown {
  const baseGbp = cardrushJpy / gbpJpyRate;
  const priceExVat = baseGbp * (1 + SEALED_MARGIN_PCT) + SEALED_FLAT_FEE;

  return {
    baseGbp: round2(baseGbp),
    priceExVat: round2(priceExVat),
  };
}

export function calculatePriceByCategory(
  cardrushJpy: number,
  gbpJpyRate: number,
  category: string | null,
): PriceBreakdown {
  return category === "sealed"
    ? calculateSealedPrice(cardrushJpy, gbpJpyRate)
    : calculatePrice(cardrushJpy, gbpJpyRate);
}

export function applyVolumeDiscount(priceExVat: number, discountFraction: number): number {
  return round2(priceExVat * (1 - discountFraction));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
