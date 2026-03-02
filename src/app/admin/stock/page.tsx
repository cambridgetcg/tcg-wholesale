"use client";

import { useState, useEffect, useCallback } from "react";

interface StockRow {
  card_id: number;
  card_number: string;
  name: string;
  set_code: string | null;
  image_url: string | null;
  sku: string;
  condition: string;
  qty_purchased: number;
  qty_fulfilled: number;
  qty_on_hand: number;
}

type SortKey = "card_number" | "qty_on_hand" | "qty_purchased" | "condition";

export default function AdminStockPage() {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockOnly, setStockOnly] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("qty_on_hand");
  const [sortAsc, setSortAsc] = useState(false);

  const fetchStock = useCallback(async () => {
    const res = await fetch("/api/admin/stock");
    const data = await res.json();
    setRows(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "card_number");
    }
  }

  const filtered = stockOnly ? rows.filter((r) => r.qty_on_hand > 0) : rows;

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "card_number": cmp = a.card_number.localeCompare(b.card_number); break;
      case "qty_on_hand": cmp = a.qty_on_hand - b.qty_on_hand; break;
      case "qty_purchased": cmp = a.qty_purchased - b.qty_purchased; break;
      case "condition": cmp = a.condition.localeCompare(b.condition); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const totalOnHand = filtered.reduce((s, r) => s + r.qty_on_hand, 0);
  const totalPurchased = filtered.reduce((s, r) => s + r.qty_purchased, 0);

  if (loading) return <div className="text-gray-400">Loading stock...</div>;

  const sortIcon = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u25B2" : " \u25BC") : "";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stock Inventory</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {filtered.length} items &middot; {totalOnHand} on hand / {totalPurchased} purchased
          </span>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={stockOnly}
              onChange={(e) => setStockOnly(e.target.checked)}
              className="accent-brand-500"
            />
            In stock only
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
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
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Set</th>
              <th
                className="px-4 py-3 font-medium cursor-pointer hover:text-white transition"
                onClick={() => handleSort("condition")}
              >
                Condition{sortIcon("condition")}
              </th>
              <th
                className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white transition"
                onClick={() => handleSort("qty_purchased")}
              >
                Purchased{sortIcon("qty_purchased")}
              </th>
              <th className="px-4 py-3 font-medium text-right">Fulfilled</th>
              <th
                className="px-4 py-3 font-medium text-right cursor-pointer hover:text-white transition"
                onClick={() => handleSort("qty_on_hand")}
              >
                On Hand{sortIcon("qty_on_hand")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e1e2e]">
            {sorted.map((row) => (
              <tr key={`${row.card_id}-${row.condition}`} className="hover:bg-[#12121a]">
                <td className="px-4 py-3">
                  {row.image_url ? (
                    <img
                      src={row.image_url}
                      alt={row.card_number}
                      className="h-10 w-7 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-7 rounded bg-gray-800" />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.card_number}</td>
                <td className="px-4 py-3 max-w-[260px] truncate" title={row.name}>
                  {row.name}
                </td>
                <td className="px-4 py-3 text-gray-400">{row.set_code || "\u2014"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    row.condition === "Mint"
                      ? "bg-green-900/40 text-green-400"
                      : "bg-yellow-900/40 text-yellow-400"
                  }`}>
                    {row.condition}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{row.qty_purchased}</td>
                <td className="px-4 py-3 text-right text-gray-400">{row.qty_fulfilled}</td>
                <td className="px-4 py-3 text-right font-bold">
                  <span className={row.qty_on_hand > 0 ? "text-green-400" : "text-gray-500"}>
                    {row.qty_on_hand}
                  </span>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No stock records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
