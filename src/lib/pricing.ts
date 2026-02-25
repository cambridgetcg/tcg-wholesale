export interface PriceBreakdown {
  baseGbp: number;
  shipping: number;
  landedCost: number;
  margin: number;
  priceExVat: number;
}

export function calculatePrice(cardrushJpy: number, gbpJpyRate: number): PriceBreakdown {
  const baseGbp = cardrushJpy / gbpJpyRate;
  const shipping = baseGbp * 0.05;
  const landedCost = baseGbp + shipping;
  const margin = landedCost * 0.20;
  const priceExVat = landedCost + margin;

  return {
    baseGbp: round2(baseGbp),
    shipping: round2(shipping),
    landedCost: round2(landedCost),
    margin: round2(margin),
    priceExVat: round2(priceExVat),
  };
}

export function calculateVolumeDiscount(priorMonthSpend: number): number {
  if (priorMonthSpend < 10000) return 0;
  const bracket = Math.floor(priorMonthSpend / 10000);
  return Math.min(bracket * 2, 10);
}

export function applyVolumeDiscount(priceExVat: number, discountPct: number): number {
  return round2(priceExVat * (1 - discountPct / 100));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
