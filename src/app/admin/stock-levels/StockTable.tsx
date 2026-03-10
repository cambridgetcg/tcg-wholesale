"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface CardRow {
  id: number;
  cardNumber: string;
  sku: string;
  name: string | null;
  setCode: string | null;
  imageUrl: string | null;
  stock: number;
  pendingStock: number;
}

export default function StockTable({
  cards: initialCards,
  currentSort,
  currentOrder,
}: {
  cards: CardRow[];
  currentSort: string;
  currentOrder: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cards, setCards] = useState(initialCards);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setCards(initialCards); }, [initialCards]);
  useEffect(() => { if (editingId !== null) inputRef.current?.select(); }, [editingId]);

  function toggleSort(field: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (currentSort === field) {
      params.set("order", currentOrder === "asc" ? "desc" : "asc");
    } else {
      params.set("sort", field);
      params.set("order", field === "stock" ? "desc" : "asc");
    }
    params.delete("page");
    router.push(`/admin/stock-levels?${params.toString()}`);
  }

  const sortIndicator = (field: string) =>
    currentSort === field ? (currentOrder === "asc" ? " \u25B2" : " \u25BC") : "";

  const saveStock = useCallback(async (cardId: number, stock: number) => {
    setSaving(cardId);
    await fetch("/api/admin/stock/adjust", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, stock }),
    });
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, stock } : c)));
    setSaving(null);
    setEditingId(null);
  }, []);

  const commitEdit = useCallback((card: CardRow) => {
    const val = parseInt(editValue);
    if (!isNaN(val) && val >= 0 && val !== card.stock) {
      saveStock(card.id, val);
    } else {
      setEditingId(null);
    }
  }, [editValue, saveStock]);

  function handleKeyDown(e: React.KeyboardEvent, card: CardRow) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit(card);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  }

  function startEdit(card: CardRow) {
    setEditingId(card.id);
    setEditValue(String(card.stock));
  }

  function increment(card: CardRow, delta: number) {
    const newVal = Math.max(0, card.stock + delta);
    saveStock(card.id, newVal);
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-8 text-center text-gray-500">
        No cards found
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
      <table className="w-full text-sm">
        <thead className="bg-[#12121a]">
          <tr className="text-left text-gray-400">
            <th className="px-2 md:px-4 py-3 font-medium w-12"></th>
            <th
              className="px-2 md:px-4 py-3 font-medium cursor-pointer hover:text-gray-200 transition select-none"
              onClick={() => toggleSort("cardNumber")}
            >
              Card{sortIndicator("cardNumber")}
            </th>
            <th className="hidden md:table-cell px-4 py-3 font-medium">SKU</th>
            <th
              className="hidden md:table-cell px-4 py-3 font-medium cursor-pointer hover:text-gray-200 transition select-none"
              onClick={() => toggleSort("set")}
            >
              Set{sortIndicator("set")}
            </th>
            <th
              className="px-2 md:px-4 py-3 font-medium text-center cursor-pointer hover:text-gray-200 transition select-none"
              onClick={() => toggleSort("stock")}
            >
              Stock{sortIndicator("stock")}
            </th>
            <th className="px-2 md:px-4 py-3 font-medium text-center w-28">Adjust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e2e]">
          {cards.map((card) => (
            <tr key={card.id} className="hover:bg-[#12121a] transition">
              <td className="px-2 md:px-4 py-1">
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt={card.cardNumber}
                    className="h-20 w-14 object-cover rounded hover:opacity-80 transition cursor-pointer"
                    loading="lazy"
                    onClick={() => setLightbox(card.imageUrl)}
                  />
                ) : (
                  <div className="h-20 w-14 rounded bg-[#1e1e2e]" />
                )}
              </td>
              <td className="px-2 md:px-4 py-3">
                <div className="font-mono text-brand-500">{card.cardNumber}</div>
                <div className="text-xs text-gray-500 truncate max-w-[200px]">{card.name || "\u2014"}</div>
              </td>
              <td className="hidden md:table-cell px-4 py-3 text-gray-400 font-mono text-xs">{card.sku}</td>
              <td className="hidden md:table-cell px-4 py-3 text-gray-400">{card.setCode || "\u2014"}</td>
              <td className="px-2 md:px-4 py-3 text-center">
                {editingId === card.id ? (
                  <input
                    ref={inputRef}
                    type="number"
                    min={0}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, card)}
                    onBlur={() => commitEdit(card)}
                    className="w-16 rounded border border-brand-500 bg-[#0a0a0f] px-2 py-1 text-center text-sm focus:outline-none"
                  />
                ) : (
                  <button
                    onClick={() => startEdit(card)}
                    className={`font-bold text-lg min-w-[2rem] ${card.stock > 0 ? "text-green-400" : "text-gray-500"}`}
                    title="Click to edit"
                  >
                    {card.stock}
                    {card.pendingStock > 0 && (
                      <span className="ml-1 text-yellow-500 text-xs font-normal">(+{card.pendingStock})</span>
                    )}
                  </button>
                )}
              </td>
              <td className="px-2 md:px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => increment(card, -1)}
                    disabled={card.stock === 0 || saving === card.id}
                    className="rounded bg-red-900/40 px-2.5 py-1 text-red-400 hover:bg-red-900/60 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-bold"
                  >
                    &minus;
                  </button>
                  <button
                    onClick={() => increment(card, 1)}
                    disabled={saving === card.id}
                    className="rounded bg-green-900/40 px-2.5 py-1 text-green-400 hover:bg-green-900/60 transition disabled:opacity-30 text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Card preview"
            className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
