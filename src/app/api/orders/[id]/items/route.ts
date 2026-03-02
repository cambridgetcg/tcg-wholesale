import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, cards, orderStatusHistory } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const orderId = parseInt(id);
  if (isNaN(orderId)) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const items = await db
    .select({
      id: orderItems.id,
      cardId: orderItems.cardId,
      cardNumber: sql<string>`coalesce(${cards.cardNumber}, 'Unknown')`.as("card_number"),
      imageUrl: cards.imageUrl,
      cardrushJpy: cards.cardrushJpy,
      cardrushUrl: cards.cardrushUrl,
      quantity: orderItems.quantity,
      unitPriceExVat: orderItems.unitPriceExVat,
      lineTotal: orderItems.lineTotal,
      stockStatus: orderItems.stockStatus,
    })
    .from(orderItems)
    .leftJoin(cards, eq(orderItems.cardId, cards.id))
    .where(eq(orderItems.orderId, orderId));

  return NextResponse.json(items);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const orderId = parseInt(id);

  // Verify order exists and is in submitted status
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "submitted") {
    return NextResponse.json({ error: "Can only adjust items on submitted orders" }, { status: 400 });
  }

  const body = await req.json() as {
    items: {
      id: number;
      unitPriceExVat: number;
      quantity: number;
      available: boolean;
    }[];
    adminNotes?: string;
  };

  // Delete unavailable items
  const unavailableIds = body.items.filter((i) => !i.available).map((i) => i.id);
  for (const itemId of unavailableIds) {
    await db.delete(orderItems).where(eq(orderItems.id, itemId));
  }

  // Update available items with new prices/quantities, saving originals
  const availableItems = body.items.filter((i) => i.available);
  for (const item of availableItems) {
    // Fetch current item to save original price
    const [current] = await db.select().from(orderItems).where(eq(orderItems.id, item.id)).limit(1);
    if (!current) continue;

    const lineTotal = Math.round(item.unitPriceExVat * item.quantity * 100) / 100;
    await db.update(orderItems)
      .set({
        unitPriceExVat: item.unitPriceExVat,
        quantity: item.quantity,
        originalUnitPrice: current.originalUnitPrice ?? current.unitPriceExVat,
        lineTotal,
      })
      .where(eq(orderItems.id, item.id));
  }

  // Recalculate order total
  const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const total = allItems.reduce((sum, i) => sum + i.lineTotal, 0);

  // Set quoted timestamps
  const quotedAt = new Date();
  const quotedExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

  await db.update(orders)
    .set({
      totalExVat: Math.round(total * 100) / 100,
      status: "quoted",
      adminNotes: body.adminNotes || null,
      quotedAt,
      quotedExpiresAt,
      updatedAt: quotedAt,
    })
    .where(eq(orders.id, orderId));

  // Record status change in audit log
  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: "submitted",
    toStatus: "quoted",
    changedBy: parseInt(session.user.id),
    changedAt: quotedAt,
    note: `Quote sent: ${unavailableIds.length} items removed, ${availableItems.length} items quoted`,
  });

  const [updated] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return NextResponse.json(updated);
}
