"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart, type CardData } from "@/lib/cart-context";
import { applyVolumeDiscount } from "@/lib/pricing";

interface CardRow {
  id: number;
  cardNumber: string;
  sku: string;
  name: string | null;
  setCode: string | null;
  setName: string | null;
  priceExVat: number | null;
}

export default function CardTable({
  cards,
  currentSort,
  currentOrder,
  volumeDiscountPct,
}: {
  cards: CardRow[];
  currentSort: string;
  currentOrder: string;
  volumeDiscountPct: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem } = useCart();

  function toggleSort(column: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === column && currentOrder === "asc") {
      params.set("sort", column);
      params.set("order", "desc");
    } else {
      params.set("sort", column);
      params.set("order", "asc");
    }
    router.push(`/catalog?${params.toString()}`);
  }

  function sortIndicator(column: string) {
    if (currentSort !== column) return null;
    return currentOrder === "asc" ? " \u2191" : " \u2193";
  }

  const [quantities, setQuantities] = useState<Record<number, number>>({});

  function handleAdd(card: CardRow) {
    const qty = quantities[card.id] || 1;
    addItem({
      id: card.id,
      cardNumber: card.cardNumber,
      sku: card.sku,
      name: card.name ?? "",
      setCode: card.setCode,
      setName: card.setName,
      priceExVat: card.priceExVat ?? 0,
    }, qty);
    setQuantities((prev) => ({ ...prev, [card.id]: 1 }));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
      <table className="w-full text-sm">
        <thead className="bg-[#12121a]">
          <tr className="text-left text-gray-400">
            <th
              className="px-4 py-3 font-medium cursor-pointer hover:text-gray-200 transition select-none"
              onClick={() => toggleSort("cardNumber")}
            >
              Card #{sortIndicator("cardNumber")}
            </th>
            <th className="px-4 py-3 font-medium">SKU</th>
            <th
              className="px-4 py-3 font-medium cursor-pointer hover:text-gray-200 transition select-none"
              onClick={() => toggleSort("set")}
            >
              Set{sortIndicator("set")}
            </th>
            <th
              className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-200 transition select-none"
              onClick={() => toggleSort("price")}
            >
              Price (ex-VAT){sortIndicator("price")}
            </th>
            <th className="px-4 py-3 font-medium text-right"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e2e]">
          {cards.map((card) => {
            const price = card.priceExVat ?? 0;
            const discounted = volumeDiscountPct > 0
              ? applyVolumeDiscount(price, volumeDiscountPct)
              : price;

            return (
              <tr key={card.id} className="hover:bg-[#12121a] transition">
                <td className="px-4 py-3 font-mono text-brand-500">
                  {card.cardNumber}
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                  {card.sku}
                </td>
                <td className="px-4 py-3 text-gray-400">{card.setCode}</td>
                <td className="px-4 py-3 text-right">
                  {volumeDiscountPct > 0 ? (
                    <>
                      <span className="text-gray-500 line-through mr-2">
                        {"\u00a3"}{price.toFixed(2)}
                      </span>
                      <span className="font-medium text-green-400">
                        {"\u00a3"}{discounted.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="font-medium text-green-400">
                      {"\u00a3"}{price.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <input
                      type="number"
                      min={1}
                      value={quantities[card.id] || 1}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [card.id]: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-16 rounded bg-[#0a0a0f] border border-[#1e1e2e] px-2 py-1 text-xs text-center focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      onClick={() => handleAdd(card)}
                      className="rounded bg-brand-600 px-3 py-1 text-xs font-medium hover:bg-brand-700 transition whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {cards.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No cards found. Try adjusting your search or filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
