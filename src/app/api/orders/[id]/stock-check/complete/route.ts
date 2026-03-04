import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orderItems, orders, cards, orderStatusHistory } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { calculatePriceByCategory } from "@/lib/pricing";
import { sendOrderEmail } from "@/lib/email/send-order-email";
import { captureItemsSnapshot } from "@/lib/order-snapshot";

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
      checkedQuantity: orderItems.checkedQuantity,
    })
    .from(orderItems)
    .where(sql`${orderItems.orderId} = ${orderId} AND ${orderItems.removedAt} IS NULL`);

  // Verify all items have been checked
  const unchecked = items.filter((i) => i.stockStatus === "pending");
  if (unchecked.length > 0) {
    return NextResponse.json({ error: `${unchecked.length} item(s) not yet checked` }, { status: 400 });
  }

  // Snapshot items BEFORE mutation for audit trail
  const snapshot = await captureItemsSnapshot(orderId);

  let removedCount = 0;
  let updatedCount = 0;

  // Soft-delete out-of-stock items
  const outOfStock = items.filter((i) => i.stockStatus === "out_of_stock");
  for (const item of outOfStock) {
    await db.update(orderItems).set({ removedAt: new Date() }).where(eq(orderItems.id, item.id));
    removedCount++;
  }

  // Update price-changed items
  const priceChanged = items.filter((i) => i.stockStatus === "price_changed" && i.checkedPriceJpy != null);
  for (const item of priceChanged) {
    // Look up the card to get gbpJpyRate
    const [card] = await db.select().from(cards).where(eq(cards.id, item.cardId)).limit(1);
    if (!card || !card.gbpJpyRate) continue;

    const newPrice = calculatePriceByCategory(item.checkedPriceJpy!, card.gbpJpyRate, card.category);
    // Sanity check: reject prices that are negative or more than 10x the original
    if (newPrice.priceExVat <= 0 || (item.unitPriceExVat > 0 && newPrice.priceExVat > item.unitPriceExVat * 10)) {
      return NextResponse.json({
        error: `Calculated price £${newPrice.priceExVat.toFixed(2)} for item #${item.id} is unreasonable (original: £${item.unitPriceExVat.toFixed(2)})`,
      }, { status: 400 });
    }
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

  // Update partial items — reduce quantity and optionally recalculate price
  let partialCount = 0;
  const partialItems = items.filter((i) => i.stockStatus === "partial" && i.checkedQuantity != null);
  for (const item of partialItems) {
    let unitPrice = item.unitPriceExVat;

    // If a new JPY price was also provided, recalculate unit price
    if (item.checkedPriceJpy != null) {
      const [card] = await db.select().from(cards).where(eq(cards.id, item.cardId)).limit(1);
      if (card?.gbpJpyRate) {
        const newPrice = calculatePriceByCategory(item.checkedPriceJpy, card.gbpJpyRate, card.category);
        if (newPrice.priceExVat > 0 && (item.unitPriceExVat === 0 || newPrice.priceExVat <= item.unitPriceExVat * 10)) {
          unitPrice = newPrice.priceExVat;
        }
      }
    }

    const newQty = item.checkedQuantity!;
    const lineTotal = Math.round(unitPrice * newQty * 100) / 100;

    await db.update(orderItems)
      .set({
        quantity: newQty,
        unitPriceExVat: unitPrice,
        originalUnitPrice: item.originalUnitPrice ?? item.unitPriceExVat,
        lineTotal,
      })
      .where(eq(orderItems.id, item.id));
    partialCount++;
  }

  // Recalculate order total from remaining (non-removed) items
  const remaining = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const newTotal = Math.round(remaining.filter((i) => !i.removedAt).reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;

  const now = new Date();
  const quotedExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

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

  // Record status change in audit log
  await db.insert(orderStatusHistory).values({
    orderId,
    fromStatus: "submitted",
    toStatus: "quoted",
    changedBy: parseInt(session.user.id),
    changedAt: now,
    note: `Stock check complete: ${removedCount} removed, ${updatedCount} price updated, ${partialCount} partial`,
    itemsSnapshot: snapshot,
  });

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
