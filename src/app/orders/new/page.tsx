"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import { useCart, type CardData } from "@/lib/cart-context";

interface SearchCard {
  id: number;
  cardNumber: string;
  sku: string;
  name: string;
  setName: string;
  priceExVat: number;
  setCode: string | null;
}

export default function NewOrderPage() {
  const router = useRouter();
  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clear,
    totalExVat,
    discountedTotal,
    itemCount,
    volumeDiscountPct,
  } = useCart();
  const [cards, setCards] = useState<SearchCard[]>([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cards?" + new URLSearchParams(search ? { q: search } : {}))
      .then((r) => r.json())
      .then(setCards);
  }, [search]);

  const discountAmount = totalExVat - discountedTotal;

  function handleAdd(card: SearchCard) {
    addItem({
      id: card.id,
      cardNumber: card.cardNumber,
      sku: card.sku,
      name: card.name ?? "",
      setCode: card.setCode,
      setName: card.setName,
      priceExVat: card.priceExVat,
    });
  }

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
        }),
      });
      if (res.ok) {
        const order = await res.json();
        clear();
        router.push(`/orders/${order.id}`);
      } else {
        setError("Failed to submit order. Please try again.");
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
        <h1 className="mb-6 text-2xl font-bold">New Order</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Card search + add */}
          <div className="lg:col-span-2">
            <input
              placeholder="Search cards to add..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-4 w-full rounded bg-[#12121a] border border-[#1e1e2e] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <div className="max-h-96 overflow-y-auto rounded-lg border border-[#1e1e2e]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#12121a]">
                  <tr className="text-left text-gray-400">
                    <th className="px-4 py-2 font-medium">Card</th>
                    <th className="px-4 py-2 font-medium">Set</th>
                    <th className="px-4 py-2 font-medium text-right">Price</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e1e2e]">
                  {cards.map((card) => (
                    <tr key={card.id} className="hover:bg-[#0a0a0f]">
                      <td className="px-4 py-2">
                        <span className="font-mono text-brand-500">{card.cardNumber}</span>{" "}
                        {card.name}
                      </td>
                      <td className="px-4 py-2 text-gray-400">{card.setName}</td>
                      <td className="px-4 py-2 text-right text-green-400">
                        &pound;{card.priceExVat.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => handleAdd(card)}
                          className="rounded bg-brand-600 px-2 py-1 text-xs hover:bg-brand-700 transition"
                        >
                          Add
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cart review */}
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
            <h2 className="mb-4 text-lg font-semibold">
              Cart{itemCount > 0 && ` (${itemCount})`}
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500">
                Add cards from the catalog or search above
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.card.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-brand-500">{item.card.cardNumber}</span>
                      <span className="ml-2 text-gray-400">
                        &pound;{item.card.priceExVat.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.card.id, item.quantity - 1)}
                        className="rounded bg-gray-800 px-2 py-0.5 hover:bg-gray-700"
                      >
                        -
                      </button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.card.id, item.quantity + 1)}
                        className="rounded bg-gray-800 px-2 py-0.5 hover:bg-gray-700"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeItem(item.card.id)}
                        className="ml-1 text-gray-500 hover:text-red-400 transition text-xs"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-[#1e1e2e] pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span>&pound;{totalExVat.toFixed(2)}</span>
                  </div>
                  {volumeDiscountPct > 0 && (
                    <div className="flex justify-between text-sm text-green-400">
                      <span>Volume Discount ({(volumeDiscountPct * 100).toFixed(0)}%)</span>
                      <span>-&pound;{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2">
                    <span>Total (ex-VAT)</span>
                    <span className="text-green-400">
                      &pound;{discountedTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-400">{error}</p>
                )}
                <button
                  onClick={submitOrder}
                  disabled={submitting || items.length === 0}
                  className="mt-4 w-full rounded bg-green-600 py-2 text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Submit Order"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
