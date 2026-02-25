import { db } from "@/lib/db";
import { orders, clients, cards } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

export default async function AdminDashboard() {
  const allOrders = await db.select().from(orders);
  const allClients = await db.select().from(clients).where(eq(clients.role, "client"));
  const allCards = await db.select().from(cards);

  const pendingOrders = allOrders.filter((o) => ["submitted", "quoted"].includes(o.status));
  const totalRevenue = allOrders
    .filter((o) => ["paid", "ordered", "shipped", "delivered"].includes(o.status))
    .reduce((sum, o) => sum + o.totalExVat, 0);

  const stats = [
    { label: "Total Cards", value: allCards.length },
    { label: "Active Clients", value: allClients.length },
    { label: "Pending Orders", value: pendingOrders.length },
    { label: "Revenue (ex-VAT)", value: `£${totalRevenue.toFixed(2)}` },
  ];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
            <p className="text-sm text-gray-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold text-brand-500">{stat.value}</p>
          </div>
        ))}
      </div>

      {pendingOrders.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Pending Orders</h2>
          <div className="space-y-2">
            {pendingOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg border border-[#1e1e2e] bg-[#12121a] p-3">
                <span>Order #{order.id}</span>
                <span className="text-sm text-gray-400">{order.status}</span>
                <span className="font-medium text-green-400">£{order.totalExVat.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
