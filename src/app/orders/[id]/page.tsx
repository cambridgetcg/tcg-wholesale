import { db } from "@/lib/db";
import { orders, orderItems, cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import CardThumbnail from "@/components/CardThumbnail";
import { VAT_RATE } from "@/lib/pricing";

const statusSteps = ["submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered"];

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const orderId = parseInt(id);
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) notFound();

  if (session.user.role !== "admin" && order.clientId !== parseInt(session.user.id)) {
    notFound();
  }

  const items = await db
    .select({
      id: orderItems.id,
      quantity: orderItems.quantity,
      unitPriceExVat: orderItems.unitPriceExVat,
      originalUnitPrice: orderItems.originalUnitPrice,
      lineTotal: orderItems.lineTotal,
      cardNumber: cards.cardNumber,
      sku: cards.sku,
      imageUrl: cards.imageUrl,
    })
    .from(orderItems)
    .innerJoin(cards, eq(orderItems.cardId, cards.id))
    .where(eq(orderItems.orderId, orderId));

  const isCancelled = order.status === "cancelled";
  const currentIdx = isCancelled ? -1 : statusSteps.indexOf(order.status);
  const isQuoted = order.status === "quoted";
  const quoteExpired = isQuoted && order.quotedExpiresAt && order.quotedExpiresAt < new Date();

  // Compute full totals
  const discountPct = order.volumeDiscount;
  const preDiscountSubtotal = discountPct > 0
    ? Math.round((order.totalExVat / (1 - discountPct)) * 100) / 100
    : order.totalExVat;
  const discountAmount = Math.round((preDiscountSubtotal - order.totalExVat) * 100) / 100;
  const vat = Math.round(order.totalExVat * VAT_RATE * 100) / 100;
  const totalIncVat = Math.round((order.totalExVat + vat) * 100) / 100;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="text-2xl font-bold">Order #{order.id}</h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="mb-6 text-sm text-gray-400">
          Created {order.createdAt?.toLocaleString() ?? "\u2014"}
        </p>

        {/* Quote valid / expired banner */}
        {isQuoted && !quoteExpired && order.quotedExpiresAt && (
          <div className="mb-6 rounded-lg bg-yellow-900/20 border border-yellow-700/30 px-4 py-3 text-sm text-yellow-300">
            Quote valid until: {order.quotedExpiresAt!.toLocaleString()}. Contact us to confirm.
          </div>
        )}
        {isQuoted && quoteExpired && (
          <div className="mb-6 rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-3 text-sm text-red-300">
            Quote expired — please resubmit or contact us.
          </div>
        )}

        {/* Status timeline */}
        {isCancelled ? (
          <div className="mb-8 rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-3 text-sm text-red-300">
            This order has been cancelled.
          </div>
        ) : (
          <div className="mb-8 flex items-center gap-1 overflow-x-auto">
            {statusSteps.map((step, i) => (
              <div key={step} className="flex items-center">
                <div
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    i <= currentIdx ? "bg-brand-600 text-white" : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {step.charAt(0).toUpperCase() + step.slice(1)}
                </div>
                {i < statusSteps.length - 1 && (
                  <div className={`h-0.5 w-6 ${i < currentIdx ? "bg-brand-600" : "bg-gray-800"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Items table */}
          <div className="lg:col-span-2 overflow-hidden rounded-lg border border-[#1e1e2e]">
            <table className="w-full text-sm">
              <thead className="bg-[#12121a]">
                <tr className="text-left text-gray-400">
                  <th className="w-12 px-4 py-3 font-medium"></th>
                  <th className="px-4 py-3 font-medium">Card #</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {items.map((item) => {
                  const priceChanged = item.originalUnitPrice != null
                    && Math.abs(item.originalUnitPrice - item.unitPriceExVat) >= 0.01;
                  return (
                    <tr key={item.id}>
                      <td className="px-4 py-1">
                        {item.imageUrl ? (
                          <CardThumbnail src={item.imageUrl} alt={item.cardNumber} />
                        ) : (
                          <div className="h-10 w-7 rounded bg-[#1e1e2e]" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-brand-500">{item.cardNumber}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{item.sku}</td>
                      <td className="px-4 py-3 text-right">
                        {priceChanged ? (
                          <span>
                            <span className="text-gray-600 line-through mr-2">
                              &pound;{item.originalUnitPrice!.toFixed(2)}
                            </span>
                            <span className="text-yellow-300">
                              &pound;{item.unitPriceExVat.toFixed(2)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-gray-400">
                            &pound;{item.unitPriceExVat.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        &pound;{item.lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary sidebar */}
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 space-y-4">
            <h2 className="font-semibold">Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span>&pound;{preDiscountSubtotal.toFixed(2)}</span>
              </div>
              {discountPct > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Volume Discount ({(discountPct * 100).toFixed(0)}%)</span>
                  <span>-&pound;{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-[#1e1e2e] pt-2 flex justify-between font-medium">
                <span>Total ex-VAT</span>
                <span>&pound;{order.totalExVat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>VAT (20%)</span>
                <span>&pound;{vat.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#1e1e2e] pt-2 flex justify-between text-lg font-bold">
                <span>Total inc VAT</span>
                <span className="text-green-400">&pound;{totalIncVat.toFixed(2)}</span>
              </div>
            </div>

            {/* Quote expiry info */}
            {order.quotedAt && (
              <div className="border-t border-[#1e1e2e] pt-3 text-xs text-gray-500">
                Quoted on {order.quotedAt!.toLocaleString()}
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="border-t border-[#1e1e2e] pt-3">
                <h3 className="text-sm font-medium text-gray-400 mb-1">Notes</h3>
                <p className="text-sm">{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
