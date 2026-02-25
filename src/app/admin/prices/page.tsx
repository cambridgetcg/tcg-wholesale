"use client";

import { useState } from "react";

export default function AdminPricesPage() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<{ synced?: number; error?: string } | null>(null);

  async function syncPrices() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ error: "Sync failed" });
    }
    setSyncing(false);
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Price Management</h1>

      <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6">
        <h2 className="mb-4 text-lg font-semibold">S3 Price Feed Sync</h2>
        <p className="mb-4 text-sm text-gray-400">
          Syncs prices from <code className="text-brand-500">s3://pricedata-tcg/pricefeed/onepiece_pricefeed.xlsx</code>
        </p>
        <button
          onClick={syncPrices}
          disabled={syncing}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium hover:bg-brand-700 transition disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
        {result && (
          <div className={`mt-4 rounded p-3 text-sm ${result.error ? "bg-red-900/20 text-red-400" : "bg-green-900/20 text-green-400"}`}>
            {result.error ? `Error: ${result.error}` : `✅ Synced ${result.synced} cards`}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6">
        <h2 className="mb-4 text-lg font-semibold">Manual CSV Upload</h2>
        <p className="mb-4 text-sm text-gray-400">Upload a CSV with columns: sku, jpy_price, gbp_jpy_rate</p>
        <input
          type="file"
          accept=".csv"
          className="text-sm text-gray-400 file:mr-4 file:rounded file:border-0 file:bg-brand-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
        />
      </div>
    </div>
  );
}
