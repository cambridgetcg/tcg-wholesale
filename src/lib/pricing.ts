export const MARGIN_PCT = 0.22;
export const PER_CARD_FEE = 0.22;
export const SEALED_MARGIN_PCT = 0.18;
export const SEALED_FLAT_FEE = 2.20;
export const VAT_MULTIPLIER = 1.20;

export interface PriceBreakdown {
  baseGbp: number;
  price: number;
}

export function calculatePrice(cardrushJpy: number, gbpJpyRate: number): PriceBreakdown {
  const baseGbp = cardrushJpy / gbpJpyRate;
  const price = (baseGbp * (1 + MARGIN_PCT) + PER_CARD_FEE) * VAT_MULTIPLIER;

  return {
    baseGbp: round2(baseGbp),
    price: round2(price),
  };
}

export function calculateSealedPrice(cardrushJpy: number, gbpJpyRate: number): PriceBreakdown {
  const baseGbp = cardrushJpy / gbpJpyRate;
  const price = (baseGbp * (1 + SEALED_MARGIN_PCT) + SEALED_FLAT_FEE) * VAT_MULTIPLIER;

  return {
    baseGbp: round2(baseGbp),
    price: round2(price),
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

export function applyVolumeDiscount(price: number, discountFraction: number): number {
  return round2(price * (1 - discountFraction));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
