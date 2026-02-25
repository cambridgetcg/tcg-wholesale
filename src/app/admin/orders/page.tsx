"use client";

import { Fragment, useState, useEffect, useCallback } from "react";
import StatusBadge from "@/components/StatusBadge";

interface Order {
  id: number;
  clientId: number;
  clientName: string | null;
  clientCompany: string | null;
  status: string;
  totalExVat: number;
  volumeDiscount: number;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface OrderItemRow {
  id: number;
  cardId: number;
  cardNumber: string;
  cardName: string | null;
  quantity: number;
  unitPriceExVat: number;
  lineTotal: number;
}

const statusFilters = ["all", "submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered", "cancelled"];

const nextAction: Record<string, { label: string; next: string } | null> = {
  submitted: { label: "Send Quote", next: "quoted" },
  quoted: { label: "Mark Confirmed", next: "confirmed" },
  confirmed: { label: "Mark Paid", next: "paid" },
  paid: { label: "Mark Ordered", next: "ordered" },
  ordered: { label: "Mark Shipped", next: "shipped" },
  shipped: { label: "Mark Delivered", next: "delivered" },
  delivered: null,
  cancelled: null,
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [items, setItems] = useState<Record<number, OrderItemRow[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/admin/orders");
    const data = await res.json();
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function toggleExpand(orderId: number) {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (!items[orderId]) {
      const res = await fetch(`/api/orders/${orderId}/items`);
      const data = await res.json();
      setItems((prev) => ({ ...prev, [orderId]: data }));
    }
  }

  async function updateStatus(orderId: number, status: string) {
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }

  const filtered = filter === "all" ? orders : orders.filter((o) => o.status === filter);

  if (loading) return <div className="text-gray-400">Loading orders...</div>;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Manage Orders</h1>

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === s
                ? "bg-brand-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1 text-gray-500">
                ({orders.filter((o) => o.status === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders table */}
      <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
        <table className="w-full text-sm">
          <thead className="bg-[#12121a]">
            <tr className="text-left text-gray-400">
              <th className="px-4 py-3 font-medium w-8"></th>
              <th className="px-4 py-3 font-medium">Order #</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {filtered.map((order) => (
              <Fragment key={order.id}>
                <tr className="hover:bg-[#12121a] cursor-pointer" onClick={() => toggleExpand(order.id)}>
                  <td className="px-4 py-3 text-gray-500">{expandedId === order.id ? "\u25BC" : "\u25B6"}</td>
                  <td className="px-4 py-3 font-medium">#{order.id}</td>
                  <td className="px-4 py-3">
                    <span>{order.clientName ?? `Client #${order.clientId}`}</span>
                    {order.clientCompany && <span className="ml-1 text-gray-500 text-xs">({order.clientCompany})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : "\u2014"}</td>
                  <td className="px-4 py-3 text-right font-medium">&pound;{order.totalExVat.toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {nextAction[order.status] && (
                        <button
                          onClick={() => updateStatus(order.id, nextAction[order.status]!.next)}
                          className="rounded bg-brand-600 px-2 py-1 text-xs font-medium hover:bg-brand-700 transition"
                        >
                          {nextAction[order.status]!.label}
                        </button>
                      )}
                      {!["delivered", "cancelled"].includes(order.status) && (
                        <button
                          onClick={() => updateStatus(order.id, "cancelled")}
                          className="rounded bg-red-900/30 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-900/50 transition"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {expandedId === order.id && (
                  <tr>
                    <td colSpan={7} className="bg-[#0e0e16] px-8 py-4">
                      {items[order.id] ? (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="py-1 text-left">Card #</th>
                              <th className="py-1 text-left">Name</th>
                              <th className="py-1 text-right">Unit Price</th>
                              <th className="py-1 text-right">Qty</th>
                              <th className="py-1 text-right">Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items[order.id].map((item) => (
                              <tr key={item.id} className="border-t border-[#1e1e2e]">
                                <td className="py-1 font-mono text-brand-500">{item.cardNumber}</td>
                                <td className="py-1 text-gray-400">{item.cardName}</td>
                                <td className="py-1 text-right">&pound;{item.unitPriceExVat.toFixed(2)}</td>
                                <td className="py-1 text-right">{item.quantity}</td>
                                <td className="py-1 text-right font-medium">&pound;{item.lineTotal.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span className="text-gray-500">Loading items...</span>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No orders found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
