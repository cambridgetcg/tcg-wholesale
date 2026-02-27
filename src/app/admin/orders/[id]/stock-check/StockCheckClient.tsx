"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CardThumbnail from "@/components/CardThumbnail";

interface StockItem {
  id: number;
  cardId: number;
  cardNumber: string;
  imageUrl: string | null;
  cardrushUrl: string | null;
  cardrushJpy: number | null;
  gbpJpyRate: number | null;
  quantity: number;
  unitPriceExVat: number;
  lineTotal: number;
  stockStatus: string;
  checkedPriceJpy: number | null;
  checkedQuantity: number | null;
  priceDiffPct: number | null;
  currentCalcPrice: number | null;
}

interface Props {
  orderId: number;
  clientName: string;
  clientCompany: string | null;
  orderTotal: number;
  items: StockItem[];
}

export default function StockCheckClient({ orderId, clientName, clientCompany, orderTotal, items: initialItems }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceInputs, setPriceInputs] = useState<Record<number, string>>(() => {
    const inputs: Record<number, string> = {};
    for (const item of initialItems) {
      if (item.checkedPriceJpy != null) {
        inputs[item.id] = item.checkedPriceJpy.toString();
      }
    }
    return inputs;
  });
  const [qtyInputs, setQtyInputs] = useState<Record<number, string>>(() => {
    const inputs: Record<number, string> = {};
    for (const item of initialItems) {
      if (item.checkedQuantity != null) {
        inputs[item.id] = item.checkedQuantity.toString();
      }
    }
    return inputs;
  });

  const checkedCount = items.filter((i) => i.stockStatus !== "pending").length;
  const allChecked = checkedCount === items.length;

  async function updateItemStatus(itemId: number, stockStatus: string, checkedPriceJpy?: number, checkedQuantity?: number) {
    setSaving(itemId);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockStatus, checkedPriceJpy, checkedQuantity }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === itemId ? { ...i, stockStatus, checkedPriceJpy: checkedPriceJpy ?? null, checkedQuantity: checkedQuantity ?? null } : i
          )
        );
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to update item status");
      }
    } finally {
      setSaving(null);
    }
  }

  async function completeStockCheck() {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/stock-check/complete`, {
        method: "POST",
      });
      if (res.ok) {
        router.push("/admin/orders");
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Failed to complete stock check");
      }
    } finally {
      setCompleting(false);
    }
  }

  function statusClasses(itemStatus: string, buttonStatus: string) {
    const active = itemStatus === buttonStatus;
    const base = "rounded px-3 py-1 text-xs font-medium transition";
    if (buttonStatus === "in_stock") {
      return active
        ? `${base} bg-green-600 text-white`
        : `${base} bg-green-900/20 text-green-400 hover:bg-green-900/40`;
    }
    if (buttonStatus === "out_of_stock") {
      return active
        ? `${base} bg-red-600 text-white`
        : `${base} bg-red-900/20 text-red-400 hover:bg-red-900/40`;
    }
    if (buttonStatus === "price_changed") {
      return active
        ? `${base} bg-amber-600 text-white`
        : `${base} bg-amber-900/20 text-amber-400 hover:bg-amber-900/40`;
    }
    if (buttonStatus === "partial") {
      return active
        ? `${base} bg-orange-600 text-white`
        : `${base} bg-orange-900/20 text-orange-400 hover:bg-orange-900/40`;
    }
    return base;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Stock Check — Order #{orderId}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            {clientName}{clientCompany ? ` (${clientCompany})` : ""} — £{orderTotal.toFixed(2)} ex-VAT
          </p>
        </div>
        <Link
          href="/admin/orders"
          className="rounded bg-gray-800 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
        >
          Back to Orders
        </Link>
      </div>

      {/* Progress */}
      <div className="mb-6 rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Progress: <span className="font-medium text-white">{checkedCount}/{items.length}</span> items checked
          </span>
          {allChecked && (
            <span className="text-green-400 font-medium">All items checked</span>
          )}
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-800">
          <div
            className="h-2 rounded-full bg-brand-600 transition-all"
            style={{ width: `${items.length > 0 ? (checkedCount / items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Items checklist */}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`rounded-lg border p-4 transition ${
              item.stockStatus === "pending"
                ? "border-[#1e1e2e] bg-[#12121a]"
                : item.stockStatus === "in_stock"
                ? "border-green-900/50 bg-green-900/10"
                : item.stockStatus === "out_of_stock"
                ? "border-red-900/50 bg-red-900/10"
                : item.stockStatus === "partial"
                ? "border-orange-900/50 bg-orange-900/10"
                : "border-amber-900/50 bg-amber-900/10"
            }`}
          >
            {/* Item header */}
            <div className="flex items-start justify-between gap-4">
              <div className="shrink-0">
                {item.imageUrl ? (
                  <CardThumbnail src={item.imageUrl} alt={item.cardNumber} className="h-12 w-auto" />
                ) : (
                  <div className="h-12 w-9 rounded bg-[#1e1e2e]" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium text-brand-500">{item.cardNumber}</span>
                </div>
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                  <span>¥{item.cardrushJpy?.toLocaleString() ?? "—"}</span>
                  <span>£{item.unitPriceExVat.toFixed(2)}</span>
                  <span>Qty: {item.quantity}</span>
                  <span className="font-medium text-gray-400">
                    Line: £{item.lineTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* CardRush link */}
              {item.cardrushUrl && (
                <a
                  href={item.cardrushUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded bg-blue-900/30 px-3 py-1 text-xs font-medium text-blue-400 hover:bg-blue-900/50 transition"
                >
                  Check Stock ↗
                </a>
              )}
            </div>

            {/* Price discrepancy alert */}
            {item.priceDiffPct != null && (
              <div className="mt-2 rounded bg-amber-900/20 border border-amber-900/30 px-3 py-2 text-xs text-amber-400">
                Price may have changed since last sync — current calc: £{item.currentCalcPrice?.toFixed(2)} vs order: £{item.unitPriceExVat.toFixed(2)} ({(item.priceDiffPct * 100).toFixed(1)}% diff)
              </div>
            )}

            {/* Status buttons */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => updateItemStatus(item.id, "in_stock")}
                disabled={saving === item.id}
                className={statusClasses(item.stockStatus, "in_stock")}
              >
                In Stock
              </button>
              <button
                onClick={() => updateItemStatus(item.id, "out_of_stock")}
                disabled={saving === item.id}
                className={statusClasses(item.stockStatus, "out_of_stock")}
              >
                Out of Stock
              </button>
              <button
                onClick={() => {
                  const jpy = parseInt(priceInputs[item.id] || "");
                  if (!isNaN(jpy) && jpy > 0) {
                    updateItemStatus(item.id, "price_changed", jpy);
                  }
                }}
                disabled={saving === item.id || !priceInputs[item.id]}
                className={statusClasses(item.stockStatus, "price_changed")}
              >
                Price Changed
              </button>
              <button
                onClick={() => {
                  const qty = parseInt(qtyInputs[item.id] || "");
                  if (!isNaN(qty) && qty >= 1 && qty < item.quantity) {
                    const jpy = parseInt(priceInputs[item.id] || "");
                    updateItemStatus(item.id, "partial", !isNaN(jpy) && jpy > 0 ? jpy : undefined, qty);
                  }
                }}
                disabled={saving === item.id || !qtyInputs[item.id]}
                className={statusClasses(item.stockStatus, "partial")}
              >
                Partial
              </button>
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-gray-500">Qty</span>
                <input
                  type="number"
                  min="1"
                  max={item.quantity - 1}
                  placeholder={`/${item.quantity}`}
                  value={qtyInputs[item.id] || ""}
                  onChange={(e) => setQtyInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  className="w-16 rounded bg-[#1a1a2e] border border-[#2a2a3e] px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-gray-500">¥</span>
                <input
                  type="number"
                  min="1"
                  placeholder="New JPY"
                  value={priceInputs[item.id] || ""}
                  onChange={(e) => setPriceInputs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  className="w-24 rounded bg-[#1a1a2e] border border-[#2a2a3e] px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>
              {saving === item.id && <span className="text-xs text-gray-500 ml-2">Saving...</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Send Quote button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={completeStockCheck}
          disabled={!allChecked || completing}
          className="rounded bg-brand-600 px-6 py-3 text-sm font-semibold hover:bg-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {completing ? "Sending Quote..." : `Send Quote (${items.filter((i) => i.stockStatus !== "out_of_stock").length} items)`}
        </button>
      </div>
    </div>
  );
}
