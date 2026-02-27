import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, clients } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// Temporary endpoint to seed historical orders. DELETE THIS FILE after running.

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Find the client account (cambridgetcg)
  const [client] = await db.select().from(clients).limit(1);
  if (!client) return NextResponse.json({ error: "No client found" }, { status: 404 });

  const results: string[] = [];

  // Order 1: £520 on 21 Feb 2026
  const [order1] = await db.insert(orders).values({
    clientId: client.id,
    status: "paid",
    totalExVat: 520,
    volumeDiscount: 0,
    notes: "Historical order — seeded",
    createdAt: new Date("2026-02-21T12:00:00Z"),
    updatedAt: new Date("2026-02-21T12:00:00Z"),
  }).returning();
  results.push(`Order #${order1.id}: £520 on 2026-02-21 (client ${client.id}: ${client.email})`);

  // Order 2: £3700 on 25 Feb 2026
  const [order2] = await db.insert(orders).values({
    clientId: client.id,
    status: "paid",
    totalExVat: 3700,
    volumeDiscount: 0,
    notes: "Historical order — seeded",
    createdAt: new Date("2026-02-25T12:00:00Z"),
    updatedAt: new Date("2026-02-25T12:00:00Z"),
  }).returning();
  results.push(`Order #${order2.id}: £3700 on 2026-02-25 (client ${client.id}: ${client.email})`);

  // Update current_month_spend to reflect these orders (£520 + £3700 = £4220)
  await db.update(clients)
    .set({ currentMonthSpend: sql`current_month_spend + 4220` })
    .where(eq(clients.id, client.id));
  results.push(`Updated current_month_spend += £4220 for client ${client.id}`);

  return NextResponse.json({ ok: true, results });
}
