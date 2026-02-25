import { cache } from "react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const getVolumeDiscount = cache(async (): Promise<number> => {
  const session = await auth();
  if (!session?.user?.id) return 0;
  const [client] = await db
    .select({ volumeDiscountPct: clients.volumeDiscountPct })
    .from(clients)
    .where(eq(clients.id, Number(session.user.id)))
    .limit(1);
  return client?.volumeDiscountPct ?? 0;
});
