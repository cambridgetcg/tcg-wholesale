"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useEffect, useState } from "react";

export default function SearchBar({
  sets,
  currentQuery,
  currentSet,
  currentSort,
  currentOrder,
}: {
  sets: { code: string; name: string }[];
  currentQuery: string;
  currentSet: string;
  currentSort: string;
  currentOrder: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setQuery(currentQuery);
  }, [currentQuery]);

  function pushParams(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    params.delete("page"); // reset to page 1 on filter change
    router.push(`/catalog?${params.toString()}`);
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushParams({ q: value });
    }, 300);
  }

  function handleSetChange(value: string) {
    pushParams({ set: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by name, card number, or SKU..."
        className="rounded bg-[#12121a] border border-[#1e1e2e] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none w-72"
      />
      <select
        value={currentSet}
        onChange={(e) => handleSetChange(e.target.value)}
        className="rounded bg-[#12121a] border border-[#1e1e2e] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      >
        <option value="">All Sets</option>
        {sets.map((s) => (
          <option key={s.code} value={s.code}>
            {s.code} — {s.name}
          </option>
        ))}
      </select>
      <select
        value={`${currentSort}-${currentOrder}`}
        onChange={(e) => {
          const [sort, order] = e.target.value.split("-");
          pushParams({ sort: sort === "cardNumber" ? "" : sort, order: order === "asc" ? "" : order });
        }}
        className="rounded bg-[#12121a] border border-[#1e1e2e] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      >
        <option value="cardNumber-asc">Card # (A→Z)</option>
        <option value="cardNumber-desc">Card # (Z→A)</option>
        <option value="price-asc">Price: Low → High</option>
        <option value="price-desc">Price: High → Low</option>
        <option value="set-asc">Set (A→Z)</option>
        <option value="set-desc">Set (Z→A)</option>
        <option value="newest-desc">Newest First</option>
      </select>
    </div>
  );
}
