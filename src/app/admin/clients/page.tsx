import { db } from "@/lib/db";
import { clients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function AdminClientsPage() {
  const allClients = await db.select().from(clients).where(eq(clients.role, "client"));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Client Management</h1>
      <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
        <table className="w-full text-sm">
          <thead className="bg-[#12121a]">
            <tr className="text-left text-gray-400">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium text-right">Current Month</th>
              <th className="px-4 py-3 font-medium text-right">Prior Month</th>
              <th className="px-4 py-3 font-medium text-right">Discount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {allClients.map((client) => (
              <tr key={client.id} className="hover:bg-[#12121a]">
                <td className="px-4 py-3">{client.name}</td>
                <td className="px-4 py-3 text-gray-400">{client.email}</td>
                <td className="px-4 py-3 text-gray-400">{client.company || "—"}</td>
                <td className="px-4 py-3 text-right">£{client.currentMonthSpend.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">£{client.priorMonthSpend.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium text-green-400">{client.volumeDiscountPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
