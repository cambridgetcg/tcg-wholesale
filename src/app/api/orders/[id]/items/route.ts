import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderItems, cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const items = await db
    .select({
      id: orderItems.id,
      cardId: orderItems.cardId,
      cardNumber: cards.cardNumber,
      cardName: cards.name,
      quantity: orderItems.quantity,
      unitPriceExVat: orderItems.unitPriceExVat,
      lineTotal: orderItems.lineTotal,
    })
    .from(orderItems)
    .innerJoin(cards, eq(orderItems.cardId, cards.id))
    .where(eq(orderItems.orderId, parseInt(id)));

  return NextResponse.json(items);
}
