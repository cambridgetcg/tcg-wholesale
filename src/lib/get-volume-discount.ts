import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Tier: every £10,000 in prior month spend = 2% off, max 10%
export const DISCOUNT_TIERS = [
  { minSpend: 0, pct: 0 },
  { minSpend: 10_000, pct: 0.02 },
  { minSpend: 20_000, pct: 0.04 },
  { minSpend: 30_000, pct: 0.06 },
  { minSpend: 40_000, pct: 0.08 },
  { minSpend: 50_000, pct: 0.10 },
] as const;

export function calcDiscountPct(priorMonthSpend: number): number {
  let pct = 0;
  for (const tier of DISCOUNT_TIERS) {
    if (priorMonthSpend >= tier.minSpend) pct = tier.pct;
  }
  return pct;
}

export const getVolumeDiscount = cache(async (): Promise<number> => {
  const info = await getVolumeDiscountInfo();
  return info.volumeDiscountPct;
});

export const getVolumeDiscountInfo = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return { volumeDiscountPct: 0, priorMonthSpend: 0, currentMonthSpend: 0 };
  const [client] = await db
    .select({
      priorMonthSpend: clients.priorMonthSpend,
      currentMonthSpend: clients.currentMonthSpend,
    })
    .from(clients)
    .where(eq(clients.id, Number(session.user.id)))
    .limit(1);
  const priorMonthSpend = client?.priorMonthSpend ?? 0;
  const currentMonthSpend = client?.currentMonthSpend ?? 0;
  const volumeDiscountPct = calcDiscountPct(priorMonthSpend);
  return { volumeDiscountPct, priorMonthSpend, currentMonthSpend };
});
