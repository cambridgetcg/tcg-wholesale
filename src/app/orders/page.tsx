import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import StatusBadge from "@/components/StatusBadge";
import Link from "next/link";

export default async function OrdersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const clientId = parseInt(session.user.id);
  const isAdmin = session.user.role === "admin";

  const allOrders = isAdmin
    ? await db.select().from(orders).orderBy(desc(orders.createdAt))
    : await db.select().from(orders).where(eq(orders.clientId, clientId)).orderBy(desc(orders.createdAt));

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Orders</h1>
          <Link
            href="/orders/new"
            className="rounded bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-700 transition"
          >
            New Order
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
          <table className="w-full text-sm">
            <thead className="bg-[#12121a]">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Order #</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Total (ex-VAT)</th>
                <th className="px-4 py-3 font-medium text-right">Discount</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {allOrders.map((order) => (
                <tr key={order.id} className="hover:bg-[#12121a] transition">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${order.id}`} className="text-brand-500 hover:underline">
                      #{order.id}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 text-right font-medium">£{order.totalExVat.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{order.volumeDiscount}%</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(order.createdAt ?? "").toLocaleDateString()}</td>
                </tr>
              ))}
              {allOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No orders yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
