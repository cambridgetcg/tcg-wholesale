"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

export default function StockLevelsPage() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState<number | null>(null);
  const [showStocked, setShowStocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim() && !showStocked) {
      setCards([]);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (showStocked) params.set("stocked", "1");
    const res = await fetch(`/api/admin/stock/levels?${params}`);
    const data = await res.json();
    setCards(data);
    setLoading(false);
  }, [showStocked]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (editingId !== null) inputRef.current?.select();
  }, [editingId]);

  async function saveStock(cardId: number, stock: number) {
    setSaving(cardId);
    await fetch("/api/admin/stock/adjust", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, stock }),
    });
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, stock } : c))
    );
    setSaving(null);
    setEditingId(null);
  }

  function handleKeyDown(e: React.KeyboardEvent, card: CardRow) {
    if (e.key === "Enter") {
      const val = parseInt(editValue);
      if (!isNaN(val) && val >= 0) saveStock(card.id, val);
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

  const totalStock = cards.reduce((s, c) => s + c.stock, 0);
  const totalPending = cards.reduce((s, c) => s + c.pendingStock, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Stock Levels</h1>
        <div className="flex items-center gap-4">
          {cards.length > 0 && (
            <span className="text-sm text-gray-400">
              {cards.length} cards &middot; {totalStock} in stock
              {totalPending > 0 && <> &middot; {totalPending} pending</>}
            </span>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showStocked}
              onChange={(e) => setShowStocked(e.target.checked)}
              className="accent-brand-500"
            />
            Show stocked
          </label>
        </div>
      </div>

      <div className="mb-6">
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by card number, name, or set..."
          className="w-full rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-3 text-sm focus:border-brand-500 focus:outline-none transition"
        />
      </div>

      {loading && <div className="text-gray-400 text-sm">Searching...</div>}

      {!loading && cards.length === 0 && (query.trim() || showStocked) && (
        <div className="text-gray-500 text-sm">No cards found.</div>
      )}

      {!loading && cards.length === 0 && !query.trim() && !showStocked && (
        <div className="text-gray-500 text-sm">
          Search for a card to set its stock level, or check &ldquo;Show stocked&rdquo; to see cards with stock.
        </div>
      )}

      {cards.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
          <table className="w-full text-sm">
            <thead className="bg-[#12121a]">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium w-12"></th>
                <th className="px-4 py-3 font-medium">Card</th>
                <th className="hidden md:table-cell px-4 py-3 font-medium">Name</th>
                <th className="hidden md:table-cell px-4 py-3 font-medium">Set</th>
                <th className="px-4 py-3 font-medium text-center">Stock</th>
                <th className="px-4 py-3 font-medium text-center w-32">Adjust</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {cards.map((card) => (
                <tr key={card.id} className="hover:bg-[#12121a] transition">
                  <td className="px-4 py-3">
                    {card.imageUrl ? (
                      <img src={card.imageUrl} alt={card.cardNumber} className="h-10 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-7 rounded bg-gray-800" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-brand-500">{card.cardNumber}</div>
                    <div className="text-xs text-gray-500 font-mono">{card.sku}</div>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-400 max-w-[240px] truncate" title={card.name ?? ""}>
                    {card.name || "\u2014"}
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-400">{card.setCode || "\u2014"}</td>
                  <td className="px-4 py-3 text-center">
                    {editingId === card.id ? (
                      <input
                        ref={inputRef}
                        type="number"
                        min={0}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, card)}
                        onBlur={() => setEditingId(null)}
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
                  <td className="px-4 py-3 text-center">
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
        </div>
      )}
    </div>
  );
}
