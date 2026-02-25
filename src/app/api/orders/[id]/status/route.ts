import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

const validStatuses = ["draft", "submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered", "cancelled"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const orderId = parseInt(id);
  const body = await req.json() as {
    status?: string;
    items?: { id: number; unitPriceExVat: number }[];
  };

  // Update line item prices if provided (for quote adjustments)
  if (body.items?.length) {
    for (const item of body.items) {
      const [lineItem] = await db.select().from(orderItems).where(eq(orderItems.id, item.id)).limit(1);
      if (!lineItem || lineItem.orderId !== orderId) continue;
      const lineTotal = Math.round(item.unitPriceExVat * lineItem.quantity * 100) / 100;
      await db.update(orderItems)
        .set({ unitPriceExVat: item.unitPriceExVat, lineTotal })
        .where(eq(orderItems.id, item.id));
    }
    // Recalculate order total from all items
    const allItems = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    const total = allItems.reduce((sum, i) => sum + i.lineTotal, 0);
    await db.update(orders)
      .set({ totalExVat: Math.round(total * 100) / 100, updatedAt: new Date().toISOString() })
      .where(eq(orders.id, orderId));
  }

  // Update status if provided
  if (body.status) {
    if (!validStatuses.includes(body.status as typeof validStatuses[number])) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    await db.update(orders)
      .set({ status: body.status as typeof validStatuses[number], updatedAt: new Date().toISOString() })
      .where(eq(orders.id, orderId));
  }

  const [updated] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return NextResponse.json(updated);
}
