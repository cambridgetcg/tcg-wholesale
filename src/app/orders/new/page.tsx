"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";

interface Card {
  id: number;
  cardNumber: string;
  name: string;
  setName: string;
  priceExVat: number;
}

interface CartItem {
  card: Card;
  quantity: number;
}

export default function NewOrderPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [cards, setCards] = useState<Card[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/cards?" + new URLSearchParams(search ? { q: search } : {}))
      .then((r) => r.json())
      .then(setCards);
  }, [search]);

  const discountPct = session?.user ? 0 : 0; // fetched from server in real use

  const subtotal = cart.reduce((sum, item) => sum + item.card.priceExVat * item.quantity, 0);
  const discountAmount = subtotal * (discountPct / 100);
  const total = subtotal - discountAmount;

  function addToCart(card: Card) {
    setCart((prev) => {
      const existing = prev.find((i) => i.card.id === card.id);
      if (existing) {
        return prev.map((i) => (i.card.id === card.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { card, quantity: 1 }];
    });
  }

  function updateQty(cardId: number, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.card.id !== cardId));
    } else {
      setCart((prev) => prev.map((i) => (i.card.id === cardId ? { ...i, quantity: qty } : i)));
    }
  }

  async function submitOrder() {
    setSubmitting(true);
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ cardId: i.card.id, quantity: i.quantity })),
      }),
    });
    if (res.ok) {
      const order = await res.json();
      router.push(`/orders/${order.id}`);
    }
    setSubmitting(false);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold">New Order</h1>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Card selection */}
          <div className="lg:col-span-2">
            <input
              placeholder="Search cards..."
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
                      <td className="px-4 py-2 text-right text-green-400">£{card.priceExVat.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => addToCart(card)}
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

          {/* Cart */}
          <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4">
            <h2 className="mb-4 text-lg font-semibold">Cart</h2>
            {cart.length === 0 ? (
              <p className="text-sm text-gray-500">Add cards to get started</p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.card.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono text-brand-500">{item.card.cardNumber}</span>
                      <span className="ml-2 text-gray-400">£{item.card.priceExVat.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.card.id, item.quantity - 1)} className="rounded bg-gray-800 px-2 py-0.5 hover:bg-gray-700">-</button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.card.id, item.quantity + 1)} className="rounded bg-gray-800 px-2 py-0.5 hover:bg-gray-700">+</button>
                    </div>
                  </div>
                ))}
                <div className="border-t border-[#1e1e2e] pt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Subtotal</span>
                    <span>£{subtotal.toFixed(2)}</span>
                  </div>
                  {discountPct > 0 && (
                    <div className="flex justify-between text-sm text-green-400">
                      <span>Volume Discount ({discountPct}%)</span>
                      <span>-£{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2">
                    <span>Total</span>
                    <span className="text-green-400">£{total.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={submitting}
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
