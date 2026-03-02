"use client";

import { useState } from "react";
import CardThumbnail from "@/components/CardThumbnail";

type Item = {
  id: number;
  quantity: number;
  unitPriceExVat: number;
  originalUnitPrice: number | null;
  lineTotal: number;
  cardNumber: string;
  sku: string;
  imageUrl: string | null;
};

function compareCardNumber(a: string, b: string): number {
  // Natural sort: split "001/064" into parts for numeric comparison
  const pa = a.split(/[\/\-]/);
  const pb = b.split(/[\/\-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = parseInt(pa[i]) || 0;
    const nb = parseInt(pb[i]) || 0;
    if (na !== nb) return na - nb;
    // fallback to string compare if numeric parts equal
    const sa = pa[i] ?? "";
    const sb = pb[i] ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
  }
  return 0;
}

export default function OrderItemsTable({ items }: { items: Item[] }) {
  const [sort, setSort] = useState<"asc" | "desc" | null>(null);

  const sorted = sort
    ? [...items].sort((a, b) => {
        const cmp = compareCardNumber(a.cardNumber, b.cardNumber);
        return sort === "asc" ? cmp : -cmp;
      })
    : items;

  const arrow = sort === "asc" ? " \u2191" : sort === "desc" ? " \u2193" : "";

  return (
    <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-[#1e1e2e]">
      <table className="w-full text-sm">
        <thead className="bg-[#12121a]">
          <tr className="text-left text-gray-400">
            <th className="w-12 px-2 md:px-4 py-3 font-medium"></th>
            <th
              className="px-2 md:px-4 py-3 font-medium cursor-pointer select-none hover:text-white transition"
              onClick={() =>
                setSort((prev) =>
                  prev === null ? "asc" : prev === "asc" ? "desc" : null,
                )
              }
            >
              Card #{arrow}
            </th>
            <th className="hidden md:table-cell px-4 py-3 font-medium">SKU</th>
            <th className="px-2 md:px-4 py-3 font-medium text-right">Unit Price</th>
            <th className="px-2 md:px-4 py-3 font-medium text-right">Qty</th>
            <th className="px-2 md:px-4 py-3 font-medium text-right">Line Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1e1e2e]">
          {sorted.map((item) => {
            const priceChanged = item.originalUnitPrice != null
              && Math.abs(item.originalUnitPrice - item.unitPriceExVat) >= 0.01;
            return (
              <tr key={item.id}>
                <td className="px-2 md:px-4 py-1">
                  {item.imageUrl ? (
                    <CardThumbnail src={item.imageUrl} alt={item.cardNumber} />
                  ) : (
                    <div className="h-10 w-7 rounded bg-[#1e1e2e]" />
                  )}
                </td>
                <td className="px-2 md:px-4 py-3">
                  <span className="font-mono text-brand-500">{item.cardNumber}</span>
                </td>
                <td className="hidden md:table-cell px-4 py-3 text-gray-400 font-mono text-xs">{item.sku}</td>
                <td className="px-2 md:px-4 py-3 text-right">
                  {priceChanged ? (
                    <span>
                      <span className="text-gray-600 line-through mr-2">
                        &pound;{item.originalUnitPrice!.toFixed(2)}
                      </span>
                      <span className="text-yellow-300">
                        &pound;{item.unitPriceExVat.toFixed(2)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-400">
                      &pound;{item.unitPriceExVat.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="px-2 md:px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-2 md:px-4 py-3 text-right font-medium">
                  &pound;{item.lineTotal.toFixed(2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
