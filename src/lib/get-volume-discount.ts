// Volume discount scheme removed. All functions retained as stubs returning zero
// so call sites continue to compile without modification.

export const DISCOUNT_TIERS = [] as const;

export function calcDiscountPct(_priorMonthSpend: number): number {
  return 0;
}

export const getVolumeDiscount = async (): Promise<number> => 0;

export const getVolumeDiscountInfo = async () => ({
  volumeDiscountPct: 0,
  priorMonthSpend: 0,
  currentMonthSpend: 0,
});
