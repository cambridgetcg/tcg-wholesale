"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCart, type CardData } from "@/lib/cart-context";
import { applyVolumeDiscount } from "@/lib/pricing";
import { useCatalogFilter } from "./CatalogFilterContext";
import WatermarkedImage from "./WatermarkedImage";

interface CardRow {
  id: number;
  cardNumber: string;
  sku: string;
  name: string | null;
  setCode: string | null;
  setName: string | null;
  priceExVat: number | null;
  rarity: string | null;
  imageUrl: string | null;
}

export default function CardTable({
  cards,
  currentSort,
  currentOrder,
  volumeDiscountPct,
  lastSynced,
}: {
  cards: CardRow[];
  currentSort: string;
  currentOrder: string;
  volumeDiscountPct: number;
  lastSynced: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addItem } = useCart();
  const { isPending, startFilter } = useCatalogFilter();

  function toggleSort(column: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === column && currentOrder === "asc") {
      params.set("sort", column);
      params.set("order", "desc");
    } else {
      params.set("sort", column);
      params.set("order", "asc");
    }
    startFilter(() => router.push(`/catalog?${params.toString()}`));
  }

  function sortIndicator(column: string) {
    if (currentSort !== column) return null;
    return currentOrder === "asc" ? " \u2191" : " \u2193";
  }

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [expandedImage, setExpandedImage] = useState<{ url: string; alt: string } | null>(null);

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
    <>
    <div className={`overflow-hidden rounded-lg border border-[#1e1e2e] transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
      <table className="w-full text-sm">
        <thead className="bg-[#12121a]">
          <tr className="text-left text-gray-400">
            <th className="px-4 py-3 font-medium w-14"></th>
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
            <th className="px-4 py-3 font-medium">Type</th>
            <th
              className="px-4 py-3 font-medium text-right cursor-pointer hover:text-gray-200 transition select-none"
              onClick={() => toggleSort("price")}
            >
              Price (ex-VAT){sortIndicator("price")}
              {lastSynced && (
                <div className="text-[10px] text-gray-500 font-normal">{lastSynced}</div>
              )}
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
                <td className="px-4 py-1">
                  {card.imageUrl ? (
                    <img
                      src={card.imageUrl}
                      alt={card.cardNumber}
                      className="h-10 w-auto rounded cursor-pointer hover:opacity-80 transition select-none"
                      loading="lazy"
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => setExpandedImage({ url: card.imageUrl!, alt: card.cardNumber })}
                    />
                  ) : (
                    <div className="h-10 w-7 rounded bg-[#1e1e2e]" />
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-brand-500">
                  {card.cardNumber}
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                  {card.sku}
                </td>
                <td className="px-4 py-3 text-gray-400">{card.setCode}</td>
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">
                  {card.rarity ?? "—"}
                </td>
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
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                No cards found. Try adjusting your search or filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpandedImage(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <WatermarkedImage
              src={expandedImage.url}
              alt={expandedImage.alt}
              style="diagonal-repeat"
            />
          </div>
        </div>
      )}
    </>
  );
}
