import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderItems, orders, cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { calculatePrice } from "@/lib/pricing";
import { sendOrderEmail } from "@/lib/email/send-order-email";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const orderId = parseInt(id);

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.status !== "submitted") {
    return NextResponse.json({ error: "Order must be in submitted status" }, { status: 400 });
  }

  // Get all items for this order
  const items = await db
    .select({
      id: orderItems.id,
      cardId: orderItems.cardId,
      quantity: orderItems.quantity,
      unitPriceExVat: orderItems.unitPriceExVat,
      originalUnitPrice: orderItems.originalUnitPrice,
      stockStatus: orderItems.stockStatus,
      checkedPriceJpy: orderItems.checkedPriceJpy,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  // Verify all items have been checked
  const unchecked = items.filter((i) => i.stockStatus === "pending");
  if (unchecked.length > 0) {
    return NextResponse.json({ error: `${unchecked.length} item(s) not yet checked` }, { status: 400 });
  }

  let removedCount = 0;
  let updatedCount = 0;

  // Remove out-of-stock items
  const outOfStock = items.filter((i) => i.stockStatus === "out_of_stock");
  for (const item of outOfStock) {
    await db.delete(orderItems).where(eq(orderItems.id, item.id));
    removedCount++;
  }

  // Update price-changed items
  const priceChanged = items.filter((i) => i.stockStatus === "price_changed" && i.checkedPriceJpy != null);
  for (const item of priceChanged) {
    // Look up the card to get gbpJpyRate
    const [card] = await db.select().from(cards).where(eq(cards.id, item.cardId)).limit(1);
    if (!card || !card.gbpJpyRate) continue;

    const newPrice = calculatePrice(item.checkedPriceJpy!, card.gbpJpyRate);
    const lineTotal = Math.round(newPrice.priceExVat * item.quantity * 100) / 100;

    await db.update(orderItems)
      .set({
        unitPriceExVat: newPrice.priceExVat,
        originalUnitPrice: item.originalUnitPrice ?? item.unitPriceExVat,
        lineTotal,
      })
      .where(eq(orderItems.id, item.id));
    updatedCount++;
  }

  // Recalculate order total from remaining items
  const remaining = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const newTotal = Math.round(remaining.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;

  const now = new Date();
  const quotedExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await db.update(orders)
    .set({
      totalExVat: newTotal,
      status: "quoted",
      stockCheckedAt: now,
      quotedAt: now,
      quotedExpiresAt,
      updatedAt: now,
    })
    .where(eq(orders.id, orderId));

  // Send quote ready email to client
  try {
    await sendOrderEmail(orderId, "quote_ready");
  } catch {
    // Email failure should not break stock check completion
  }

  return NextResponse.json({
    success: true,
    removedCount,
    updatedCount,
    newTotal,
  });
}
