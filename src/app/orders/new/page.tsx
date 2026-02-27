"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { useCart } from "@/lib/cart-context";
import { VAT_RATE } from "@/lib/pricing";

export default function NewOrderPage() {
  const router = useRouter();
  const {
    items,
    updateQuantity,
    removeItem,
    clear,
    totalExVat,
    discountedTotal,
    itemCount,
    volumeDiscountPct,
  } = useCart();
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const discountAmount = totalExVat - discountedTotal;
  const vat = discountedTotal * VAT_RATE;
  const totalIncVat = discountedTotal + vat;

  // Next discount tier explanation
  const currentPctDisplay = (volumeDiscountPct * 100).toFixed(0);
  const nextTierSpend = (Math.floor(volumeDiscountPct / 0.02) + 1) * 10_000;
  const nextTierPct = Math.min((Math.floor(volumeDiscountPct / 0.02) + 1) * 2, 10);
  const tierText =
    volumeDiscountPct >= 0.10
      ? "Your discount: 10% (maximum tier)"
      : `Your discount: ${currentPctDisplay}% (spend \u00a3${nextTierSpend.toLocaleString()}+ this month to unlock ${nextTierPct}%)`;

  async function submitOrder() {
    if (items.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ cardId: i.card.id, quantity: i.quantity })),
          notes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        const order = await res.json();
        clear();
        router.push(`/orders/${order.id}?submitted=1`);
      } else {
        setError("Failed to submit quote request. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection.");
    }
    setSubmitting(false);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold">Review Order</h1>

        {items.length === 0 ? (
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-8 text-center">
            <p className="text-gray-400 mb-4">Your cart is empty.</p>
            <Link
              href="/catalog"
              className="rounded bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-700 transition"
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Editable cart table */}
            <div className="lg:col-span-2 overflow-hidden rounded-lg border border-[#1e1e2e]">
              <table className="w-full text-sm">
                <thead className="bg-[#12121a]">
                  <tr className="text-left text-gray-400">
                    <th className="px-2 md:px-4 py-3 font-medium">Card #</th>
                    <th className="px-2 md:px-4 py-3 font-medium text-right">Price ex-VAT</th>
                    <th className="px-2 md:px-4 py-3 font-medium text-right">Qty</th>
                    <th className="px-2 md:px-4 py-3 font-medium text-right">Line Total</th>
                    <th className="px-2 md:px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {items.map((item) => (
                    <tr key={item.card.id}>
                      <td className="px-2 md:px-4 py-3">
                        <span className="font-mono text-brand-500">{item.card.cardNumber}</span>
                      </td>
                      <td className="px-2 md:px-4 py-3 text-right text-gray-400">
                        &pound;{item.card.priceExVat.toFixed(2)}
                      </td>
                      <td className="px-2 md:px-4 py-3 text-right">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (val >= 1) updateQuantity(item.card.id, val);
                          }}
                          className="w-16 rounded bg-[#0a0a0f] border border-[#1e1e2e] px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 md:px-4 py-3 text-right font-medium">
                        &pound;{(item.card.priceExVat * item.quantity).toFixed(2)}
                      </td>
                      <td className="px-2 md:px-4 py-3 text-right">
                        <button
                          onClick={() => removeItem(item.card.id)}
                          className="text-gray-500 hover:text-red-400 transition text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Running total sidebar */}
            <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 space-y-4">
              <h2 className="font-semibold">Order Summary</h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Subtotal</span>
                  <span>&pound;{totalExVat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-400">
                  <span>Volume Discount ({currentPctDisplay}%)</span>
                  <span>-&pound;{discountAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-[#1e1e2e] pt-2 flex justify-between font-medium">
                  <span>Total ex-VAT</span>
                  <span>&pound;{discountedTotal.toFixed(2)}</span>
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

              <p className="text-xs text-gray-500">{tierText}</p>

              {/* Notes */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special requests, delivery instructions..."
                  rows={3}
                  className="w-full rounded bg-[#0a0a0f] border border-[#1e1e2e] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <button
                onClick={submitOrder}
                disabled={submitting || items.length === 0}
                className="w-full rounded bg-green-600 py-2.5 text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit for Quote"}
              </button>

              <p className="text-xs text-gray-500 text-center">
                This submits a quote request. We&apos;ll confirm pricing and availability.
              </p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
