import { db } from "@/lib/db";
import { orders, orderItems, cards, clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { calculatePrice } from "@/lib/pricing";
import StockCheckClient from "./StockCheckClient";

export default async function StockCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") redirect("/catalog");

  const { id } = await params;
  const orderId = parseInt(id);

  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) redirect("/admin/orders");
  if (order.status !== "submitted") redirect("/admin/orders");

  const [client] = await db.select().from(clients).where(eq(clients.id, order.clientId)).limit(1);

  const items = await db
    .select({
      id: orderItems.id,
      cardId: orderItems.cardId,
      cardNumber: cards.cardNumber,
      imageUrl: cards.imageUrl,
      cardrushUrl: cards.cardrushUrl,
      cardrushJpy: cards.cardrushJpy,
      gbpJpyRate: cards.gbpJpyRate,
      quantity: orderItems.quantity,
      unitPriceExVat: orderItems.unitPriceExVat,
      lineTotal: orderItems.lineTotal,
      stockStatus: orderItems.stockStatus,
      checkedPriceJpy: orderItems.checkedPriceJpy,
      checkedQuantity: orderItems.checkedQuantity,
    })
    .from(orderItems)
    .innerJoin(cards, eq(orderItems.cardId, cards.id))
    .where(eq(orderItems.orderId, orderId));

  // Calculate price discrepancies
  const itemsWithDiscrepancy = items.map((item) => {
    let priceDiffPct: number | null = null;
    let currentCalcPrice: number | null = null;
    if (item.cardrushJpy && item.gbpJpyRate) {
      const current = calculatePrice(item.cardrushJpy, item.gbpJpyRate);
      currentCalcPrice = current.priceExVat;
      const diff = Math.abs(current.priceExVat - item.unitPriceExVat) / item.unitPriceExVat;
      if (diff > 0.05) priceDiffPct = diff;
    }
    return { ...item, priceDiffPct, currentCalcPrice };
  });

  return (
    <div>
      <StockCheckClient
        orderId={orderId}
        clientName={client?.name ?? `Client #${order.clientId}`}
        clientCompany={client?.company ?? null}
        orderTotal={order.totalExVat}
        items={itemsWithDiscrepancy}
      />
    </div>
  );
}
