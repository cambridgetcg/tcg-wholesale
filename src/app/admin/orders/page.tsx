"use client";

import { useState, useEffect } from "react";
import StatusBadge from "@/components/StatusBadge";

interface Order {
  id: number;
  clientId: number;
  status: string;
  totalExVat: number;
  volumeDiscount: number;
  createdAt: string;
}

const statuses = ["draft", "submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/admin/orders").then((r) => r.json()).then(setOrders);
  }, []);

  async function updateStatus(orderId: number, status: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Manage Orders</h1>
      <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
        <table className="w-full text-sm">
          <thead className="bg-[#12121a]">
            <tr className="text-left text-gray-400">
              <th className="px-4 py-3 font-medium">Order #</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-[#12121a]">
                <td className="px-4 py-3">#{order.id}</td>
                <td className="px-4 py-3 text-gray-400">Client #{order.clientId}</td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3 text-right font-medium">£{order.totalExVat.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value)}
                    className="rounded bg-gray-800 px-2 py-1 text-xs border border-[#1e1e2e]"
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
