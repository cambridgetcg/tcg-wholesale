import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, cards, clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { applyVolumeDiscount } from "@/lib/pricing";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = parseInt(session.user.id);
  const { items } = await req.json() as { items: { cardId: number; quantity: number }[] };

  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });

  // Get client discount
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  const discountPct = client?.volumeDiscountPct || 0;

  // Calculate totals
  let subtotal = 0;
  const resolvedItems: { cardId: number; quantity: number; unitPriceExVat: number; lineTotal: number }[] = [];

  for (const item of items) {
    const [card] = await db.select().from(cards).where(eq(cards.id, item.cardId)).limit(1);
    if (!card) continue;
    const unitPrice = applyVolumeDiscount(card.priceExVat ?? 0, discountPct);
    const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
    subtotal += lineTotal;
    resolvedItems.push({ cardId: item.cardId, quantity: item.quantity, unitPriceExVat: unitPrice, lineTotal });
  }

  const now = new Date().toISOString();
  const [order] = await db
    .insert(orders)
    .values({
      clientId,
      status: "submitted",
      totalExVat: Math.round(subtotal * 100) / 100,
      volumeDiscount: discountPct,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  for (const item of resolvedItems) {
    await db.insert(orderItems).values({ orderId: order.id, ...item });
  }

  return NextResponse.json(order);
}
