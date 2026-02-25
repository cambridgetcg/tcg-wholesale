import { db } from "@/lib/db";
import { orders, orderItems, cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";

const statusSteps = ["draft", "submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered"];

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
      lineTotal: orderItems.lineTotal,
      cardNumber: cards.cardNumber,
      cardName: cards.name,
    })
    .from(orderItems)
    .innerJoin(cards, eq(orderItems.cardId, cards.id))
    .where(eq(orderItems.orderId, orderId));

  const currentIdx = statusSteps.indexOf(order.status);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-2 text-2xl font-bold">Order #{order.id}</h1>
        <p className="mb-6 text-sm text-gray-400">
          Created {new Date(order.createdAt ?? "").toLocaleString()}
        </p>

        {/* Status timeline */}
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

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 overflow-hidden rounded-lg border border-[#1e1e2e]">
            <table className="w-full text-sm">
              <thead className="bg-[#12121a]">
                <tr className="text-left text-gray-400">
                  <th className="px-4 py-3 font-medium">Card</th>
                  <th className="px-4 py-3 font-medium text-right">Unit Price</th>
                  <th className="px-4 py-3 font-medium text-right">Qty</th>
                  <th className="px-4 py-3 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-brand-500">{item.cardNumber}</span>{" "}
                      {item.cardName}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">£{item.unitPriceExVat.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium">£{item.lineTotal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 space-y-3">
            <h2 className="font-semibold">Summary</h2>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Status</span>
              <StatusBadge status={order.status} />
            </div>
            {order.volumeDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-400">
                <span>Volume Discount</span>
                <span>{order.volumeDiscount}%</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-[#1e1e2e] pt-3">
              <span>Total (ex-VAT)</span>
              <span className="text-green-400">£{order.totalExVat.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
