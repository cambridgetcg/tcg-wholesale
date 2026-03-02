import { db } from "@/lib/db";
import { orders, orderItems, cards, fulfillmentEntries } from "@/lib/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import CardThumbnail from "@/components/CardThumbnail";

export default async function FulfillmentPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const clientId = parseInt(session.user.id);
  const isAdmin = session.user.role === "admin";

  // Get all orders in paid+ status for this client (or all for admin)
  const paidStatuses = ["paid", "ordered", "shipped", "delivered"];
  const clientOrders = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      isAdmin
        ? sql`${orders.status} = ANY(${paidStatuses})`
        : sql`${orders.clientId} = ${clientId} AND ${orders.status} = ANY(${paidStatuses})`,
    );

  const orderIds = clientOrders.map((o) => o.id);

  if (orderIds.length === 0) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="mb-6 text-2xl font-bold">Fulfillment</h1>
          <p className="text-gray-400">No orders with fulfillment tracking yet.</p>
        </main>
      </>
    );
  }

  // All order items for these orders
  const allItems = await db
    .select({
      id: orderItems.id,
      orderId: orderItems.orderId,
      quantity: orderItems.quantity,
      cardNumber: sql<string>`coalesce(${cards.cardNumber}, 'Unknown')`.as("card_number"),
      sku: sql<string>`coalesce(${cards.sku}, '—')`.as("sku"),
      imageUrl: cards.imageUrl,
    })
    .from(orderItems)
    .leftJoin(cards, eq(orderItems.cardId, cards.id))
    .where(inArray(orderItems.orderId, orderIds));

  // Fulfilled aggregates per item
  const fulfilledAgg = await db
    .select({
      orderItemId: fulfillmentEntries.orderItemId,
      total: sql<number>`sum(${fulfillmentEntries.fulfilledQty})`.as("total"),
    })
    .from(fulfillmentEntries)
    .where(inArray(fulfillmentEntries.orderId, orderIds))
    .groupBy(fulfillmentEntries.orderItemId);

  const fulfilledByItem = new Map<number, number>();
  for (const row of fulfilledAgg) {
    fulfilledByItem.set(row.orderItemId, Number(row.total));
  }

  // Fulfilled detail rows for timeline
  const fulfilledRows = await db
    .select({
      fulfillmentDate: fulfillmentEntries.fulfillmentDate,
      orderId: fulfillmentEntries.orderId,
      orderItemId: fulfillmentEntries.orderItemId,
      cardNumber: sql<string>`coalesce(${cards.cardNumber}, 'Unknown')`.as("card_number"),
      sku: sql<string>`coalesce(${cards.sku}, '—')`.as("sku"),
      imageUrl: cards.imageUrl,
      fulfilledQty: fulfillmentEntries.fulfilledQty,
    })
    .from(fulfillmentEntries)
    .innerJoin(orderItems, eq(fulfillmentEntries.orderItemId, orderItems.id))
    .innerJoin(cards, eq(orderItems.cardId, cards.id))
    .where(inArray(fulfillmentEntries.orderId, orderIds))
    .orderBy(sql`${fulfillmentEntries.fulfillmentDate} desc`);

  // Group fulfilled by date
  const fulfilledByDate = new Map<string, typeof fulfilledRows>();
  for (const row of fulfilledRows) {
    const list = fulfilledByDate.get(row.fulfillmentDate) ?? [];
    list.push(row);
    fulfilledByDate.set(row.fulfillmentDate, list);
  }

  // Unfulfilled items (remaining qty > 0)
  const unfulfilledItems = allItems
    .filter((item) => (fulfilledByItem.get(item.id) ?? 0) < item.quantity)
    .map((item) => ({
      ...item,
      remaining: item.quantity - (fulfilledByItem.get(item.id) ?? 0),
    }));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold">Fulfillment</h1>

        {/* Fulfilled — grouped by date */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Fulfilled</h2>
          {fulfilledByDate.size > 0 ? (
            <div className="space-y-6">
              {[...fulfilledByDate.entries()].map(([date, entries]) => (
                <div key={date}>
                  <h3 className="mb-3 text-sm font-medium text-gray-400">{date}</h3>
                  <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
                    <table className="w-full text-sm">
                      <thead className="bg-[#12121a]">
                        <tr className="text-left text-gray-400">
                          <th className="w-12 px-2 md:px-4 py-3 font-medium"></th>
                          <th className="px-2 md:px-4 py-3 font-medium">Card #</th>
                          <th className="hidden md:table-cell px-4 py-3 font-medium">SKU</th>
                          <th className="px-2 md:px-4 py-3 font-medium text-right">Order</th>
                          <th className="px-2 md:px-4 py-3 font-medium text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e1e2e]">
                        {entries.map((e, i) => (
                          <tr key={i}>
                            <td className="px-2 md:px-4 py-1">
                              {e.imageUrl ? (
                                <CardThumbnail src={e.imageUrl} alt={e.cardNumber} />
                              ) : (
                                <div className="h-10 w-7 rounded bg-[#1e1e2e]" />
                              )}
                            </td>
                            <td className="px-2 md:px-4 py-3">
                              <span className="font-mono text-brand-500">{e.cardNumber}</span>
                            </td>
                            <td className="hidden md:table-cell px-4 py-3 text-gray-400 font-mono text-xs">{e.sku}</td>
                            <td className="px-2 md:px-4 py-3 text-right text-gray-400">#{e.orderId}</td>
                            <td className="px-2 md:px-4 py-3 text-right text-green-400">{e.fulfilledQty}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No items fulfilled yet.</p>
          )}
        </section>

        {/* Unfulfilled / Pending */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Pending</h2>
          {unfulfilledItems.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-[#1e1e2e]">
              <table className="w-full text-sm">
                <thead className="bg-[#12121a]">
                  <tr className="text-left text-gray-400">
                    <th className="w-12 px-2 md:px-4 py-3 font-medium"></th>
                    <th className="px-2 md:px-4 py-3 font-medium">Card #</th>
                    <th className="hidden md:table-cell px-4 py-3 font-medium">SKU</th>
                    <th className="px-2 md:px-4 py-3 font-medium text-right">Order</th>
                    <th className="px-2 md:px-4 py-3 font-medium text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {unfulfilledItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 md:px-4 py-1">
                        {item.imageUrl ? (
                          <CardThumbnail src={item.imageUrl} alt={item.cardNumber} />
                        ) : (
                          <div className="h-10 w-7 rounded bg-[#1e1e2e]" />
                        )}
                      </td>
                      <td className="px-2 md:px-4 py-3">
                        <span className="font-mono text-brand-500">{item.cardNumber}</span>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3 text-gray-400 font-mono text-xs">{item.sku}</td>
                      <td className="px-2 md:px-4 py-3 text-right text-gray-400">#{item.orderId}</td>
                      <td className="px-2 md:px-4 py-3 text-right text-yellow-400">{item.remaining}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">All items have been fulfilled.</p>
          )}
        </section>
      </main>
    </>
  );
}
