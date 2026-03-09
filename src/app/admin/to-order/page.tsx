"use client";

import { useState, useEffect, useCallback } from "react";

interface ToOrderRow {
  item_id: number;
  order_id: number;
  card_id: number;
  card_number: string;
  sku: string;
  image_url: string | null;
  ordered_qty: number;
  unit_price: number;
  fulfilled_qty: number;
  purchased_qty: number;
  remambo_submitted_at: string | null;
  remaining_qty: number;
  to_order_qty: number;
}

type SortKey = "order_id" | "card_number" | "to_order_qty" | "remaining_qty" | "unit_price";
type ViewMode = "by-order" | "aggregate";

export default function AdminToOrderPage() {
  const [rows, setRows] = useState<ToOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("order_id");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("by-order");
  const [hideFullyPurchased, setHideFullyPurchased] = useState(true);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/to-order");
    const data = await res.json();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "card_number" || key === "order_id");
    }
  }

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  // Filter: optionally hide items where purchased >= remaining (nothing left to order)
  const filtered = hideFullyPurchased ? rows.filter((r) => r.to_order_qty > 0) : rows;

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "order_id": cmp = a.order_id - b.order_id; break;
      case "card_number": cmp = a.card_number.localeCompare(b.card_number); break;
      case "to_order_qty": cmp = a.to_order_qty - b.to_order_qty; break;
      case "remaining_qty": cmp = a.remaining_qty - b.remaining_qty; break;
      case "unit_price": cmp = a.unit_price - b.unit_price; break;
    }
    return sortAsc ? cmp : -cmp;
  });

  // Aggregate view: group by card_id, sum across orders
  const aggregated = (() => {
    const map = new Map<number, {
      card_id: number;
      card_number: string;
      sku: string;
      image_url: string | null;
      unit_price: number;
      total_ordered: number;
      total_fulfilled: number;
      total_purchased: number;
      total_remaining: number;
      total_to_order: number;
      order_ids: number[];
    }>();
    for (const row of filtered) {
      const existing = map.get(row.card_id);
      if (existing) {
        existing.total_ordered += row.ordered_qty;
        existing.total_fulfilled += row.fulfilled_qty;
        existing.total_purchased += row.purchased_qty;
        existing.total_remaining += row.remaining_qty;
        existing.total_to_order += row.to_order_qty;
        if (!existing.order_ids.includes(row.order_id)) existing.order_ids.push(row.order_id);
      } else {
        map.set(row.card_id, {
          card_id: row.card_id,
          card_number: row.card_number,
          sku: row.sku,
          image_url: row.image_url,
          unit_price: row.unit_price,
          total_ordered: row.ordered_qty,
          total_fulfilled: row.fulfilled_qty,
          total_purchased: row.purchased_qty,
          total_remaining: row.remaining_qty,
          total_to_order: row.to_order_qty,
          order_ids: [row.order_id],
        });
      }
    }
    return [...map.values()].sort((a, b) => {
      if (sortKey === "card_number") return sortAsc ? a.card_number.localeCompare(b.card_number) : b.card_number.localeCompare(a.card_number);
      if (sortKey === "to_order_qty") return sortAsc ? a.total_to_order - b.total_to_order : b.total_to_order - a.total_to_order;
      if (sortKey === "unit_price") return sortAsc ? a.unit_price - b.unit_price : b.unit_price - a.unit_price;
      return sortAsc ? a.card_number.localeCompare(b.card_number) : b.card_number.localeCompare(a.card_number);
    });
  })();

  // Summary stats
  const totalToOrder = filtered.reduce((s, r) => s + r.to_order_qty, 0);
  const totalRemaining = filtered.reduce((s, r) => s + r.remaining_qty, 0);
  const totalEstCost = filtered.reduce((s, r) => s + r.to_order_qty * r.unit_price, 0);
  const orderCount = new Set(filtered.map((r) => r.order_id)).size;

  if (loading) return <div className="text-gray-400">Loading to-order data...</div>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">To Be Ordered</h1>
        <div className="flex flex-wrap items-center gap-4">
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-[#1e1e2e] text-xs">
            <button
              onClick={() => setViewMode("by-order")}
              className={`px-3 py-1.5 transition ${viewMode === "by-order" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              By Order
            </button>
            <button
              onClick={() => setViewMode("aggregate")}
              className={`px-3 py-1.5 transition ${viewMode === "aggregate" ? "bg-brand-600 text-white" : "text-gray-400 hover:text-white"}`}
            >
              Aggregate
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={hideFullyPurchased}
              onChange={(e) => setHideFullyPurchased(e.target.checked)}
              className="accent-brand-500"
            />
            Needs ordering only
          </label>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
          <div className="text-xs text-gray-400">To Order</div>
          <div className="text-2xl font-bold text-yellow-400">{totalToOrder}</div>
          <div className="text-xs text-gray-500">qty across {filtered.length} items</div>
        </div>
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
          <div className="text-xs text-gray-400">Remaining to Fulfill</div>
          <div className="text-2xl font-bold">{totalRemaining}</div>
          <div className="text-xs text-gray-500">from {orderCount} orders</div>
        </div>
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
          <div className="text-xs text-gray-400">Est. Cost</div>
          <div className="text-2xl font-bold text-green-400">&pound;{totalEstCost.toFixed(2)}</div>
          <div className="text-xs text-gray-500">to order remaining</div>
        </div>
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
          <div className="text-xs text-gray-400">Pipeline</div>
          <div className="text-xs text-gray-300 mt-1 space-y-1">
            <div>Ordered: {rows.reduce((s, r) => s + r.ordered_qty, 0)}</div>
            <div>Fulfilled: {rows.reduce((s, r) => s + r.fulfilled_qty, 0)}</div>
            <div>Purchased: {rows.reduce((s, r) => s + r.purchased_qty, 0)}</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
        {viewMode === "by-order" ? (
          <table className="w-full text-sm">
            <thead className="bg-[#12121a]">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium w-12"></th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition"
                  onClick={() => handleSort("order_id")}
                >
                  Order{sortIcon("order_id")}
                </th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition"
                  onClick={() => handleSort("card_number")}
                >
                  Card{sortIcon("card_number")}
                </th>
                <th className="hidden lg:table-cell px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Ordered</th>
                <th className="px-4 py-3 font-medium text-right">Fulfilled</th>
                <th className="hidden sm:table-cell px-4 py-3 font-medium text-right">Purchased</th>
                <th
                  className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort("to_order_qty")}
                >
                  To Order{sortIcon("to_order_qty")}
                </th>
                <th
                  className="hidden sm:table-cell px-4 py-3 font-medium text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort("unit_price")}
                >
                  Unit &pound;{sortIcon("unit_price")}
                </th>
                <th className="px-4 py-3 font-medium text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {sorted.map((row) => (
                <tr key={row.item_id} className="hover:bg-[#12121a]">
                  <td className="px-4 py-2">
                    {row.image_url ? (
                      <img src={row.image_url} alt={row.card_number} className="h-10 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-7 rounded bg-gray-800" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">#{row.order_id}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.card_number}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-gray-400 font-mono text-xs">{row.sku}</td>
                  <td className="px-4 py-3 text-right">{row.ordered_qty}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={row.fulfilled_qty > 0 ? "text-green-400" : "text-gray-500"}>
                      {row.fulfilled_qty}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right">
                    <span className={row.purchased_qty > 0 ? "text-blue-400" : "text-gray-500"}>
                      {row.purchased_qty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${row.to_order_qty > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                      {row.to_order_qty}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-400">
                    &pound;{row.unit_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    &pound;{(row.to_order_qty * row.unit_price).toFixed(2)}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    {hideFullyPurchased ? "All items have been ordered from supplier." : "No unfulfilled items."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#12121a]">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium w-12"></th>
                <th
                  className="px-4 py-3 font-medium cursor-pointer hover:text-white transition"
                  onClick={() => handleSort("card_number")}
                >
                  Card{sortIcon("card_number")}
                </th>
                <th className="hidden lg:table-cell px-4 py-3 font-medium">SKU</th>
                <th className="px-4 py-3 font-medium text-right">Total Ordered</th>
                <th className="px-4 py-3 font-medium text-right">Fulfilled</th>
                <th className="hidden sm:table-cell px-4 py-3 font-medium text-right">Purchased</th>
                <th
                  className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white transition"
                  onClick={() => handleSort("to_order_qty")}
                >
                  To Order{sortIcon("to_order_qty")}
                </th>
                <th className="px-4 py-3 font-medium text-right">Est. Cost</th>
                <th className="hidden sm:table-cell px-4 py-3 font-medium">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {aggregated.map((row) => (
                <tr key={row.card_id} className="hover:bg-[#12121a]">
                  <td className="px-4 py-2">
                    {row.image_url ? (
                      <img src={row.image_url} alt={row.card_number} className="h-10 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-7 rounded bg-gray-800" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.card_number}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-gray-400 font-mono text-xs">{row.sku}</td>
                  <td className="px-4 py-3 text-right">{row.total_ordered}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={row.total_fulfilled > 0 ? "text-green-400" : "text-gray-500"}>
                      {row.total_fulfilled}
                    </span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right">
                    <span className={row.total_purchased > 0 ? "text-blue-400" : "text-gray-500"}>
                      {row.total_purchased}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${row.total_to_order > 0 ? "text-yellow-400" : "text-gray-500"}`}>
                      {row.total_to_order}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    &pound;{(row.total_to_order * row.unit_price).toFixed(2)}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-400 text-xs">
                    {row.order_ids.map((id) => `#${id}`).join(", ")}
                  </td>
                </tr>
              ))}
              {aggregated.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    {hideFullyPurchased ? "All items have been ordered from supplier." : "No unfulfilled items."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
