import Nav from "@/components/Nav";
import { getVolumeDiscountInfo, DISCOUNT_TIERS, calcDiscountPct } from "@/lib/get-volume-discount";

export default async function DiscountPage() {
  const { volumeDiscountPct, priorMonthSpend, currentMonthSpend } = await getVolumeDiscountInfo();

  // Find current tier index
  const currentTierIdx = DISCOUNT_TIERS.findLastIndex((t) => priorMonthSpend >= t.minSpend);
  const nextTier = DISCOUNT_TIERS[currentTierIdx + 1] ?? null;
  const nextTierPct = calcDiscountPct(currentMonthSpend);
  const nextTierIdx = DISCOUNT_TIERS.findLastIndex((t) => currentMonthSpend >= t.minSpend);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-bold mb-6">Volume Discounts</h1>

        {/* Current status */}
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Your Current Discount</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Last Month&apos;s Spend</p>
              <p className="text-2xl font-bold">&pound;{priorMonthSpend.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Your Discount</p>
              <p className="text-2xl font-bold text-green-400">
                {volumeDiscountPct > 0 ? `${(volumeDiscountPct * 100).toFixed(0)}% off` : "No discount"}
              </p>
            </div>
          </div>

          {nextTier && (
            <div className="mt-4 rounded bg-[#0a0a0f] border border-[#1e1e2e] px-4 py-3 text-sm text-gray-400">
              Spend{" "}
              <span className="text-white font-medium">
                &pound;{(nextTier.minSpend - priorMonthSpend).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </span>{" "}
              more to unlock{" "}
              <span className="text-green-400 font-medium">{(nextTier.pct * 100).toFixed(0)}% off</span>
            </div>
          )}
          {!nextTier && volumeDiscountPct > 0 && (
            <div className="mt-4 rounded bg-[#0a0a0f] border border-[#1e1e2e] px-4 py-3 text-sm text-green-400">
              You&apos;ve reached the maximum discount tier!
            </div>
          )}
        </div>

        {/* This month progress */}
        <div className="rounded-lg border border-[#1e1e2e] bg-[#12121a] p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">This Month&apos;s Progress</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Month Spend</p>
              <p className="text-2xl font-bold">&pound;{currentMonthSpend.toLocaleString("en-GB", { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Next Month&apos;s Discount</p>
              <p className="text-2xl font-bold text-brand-400">
                {nextTierPct > 0 ? `${(nextTierPct * 100).toFixed(0)}% off` : "No discount yet"}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {(() => {
            const nextTarget = DISCOUNT_TIERS[nextTierIdx + 1]?.minSpend;
            if (!nextTarget) return null;
            const currentBase = DISCOUNT_TIERS[nextTierIdx]?.minSpend ?? 0;
            const progress = Math.min(1, (currentMonthSpend - currentBase) / (nextTarget - currentBase));
            return (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>&pound;{currentMonthSpend.toLocaleString("en-GB", { minimumFractionDigits: 0 })}</span>
                  <span>&pound;{nextTarget.toLocaleString("en-GB")} for {((DISCOUNT_TIERS[nextTierIdx + 1]?.pct ?? 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#1e1e2e] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${(progress * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            );
          })()}
        </div>

        {/* Tier table */}
        <div className="rounded-lg border border-[#1e1e2e] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#12121a]">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Monthly Spend</th>
                <th className="px-4 py-3 font-medium text-right">Discount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {DISCOUNT_TIERS.map((tier, i) => {
                const isActive = i === currentTierIdx;
                const nextMin = DISCOUNT_TIERS[i + 1]?.minSpend;
                const range = nextMin
                  ? `£${tier.minSpend.toLocaleString()} – £${(nextMin - 0.01).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
                  : `£${tier.minSpend.toLocaleString()}+`;

                return (
                  <tr
                    key={i}
                    className={isActive
                      ? "bg-brand-600/10 border-l-2 border-l-brand-500"
                      : "hover:bg-[#12121a] transition"
                    }
                  >
                    <td className="px-4 py-3">
                      {range}
                      {isActive && (
                        <span className="ml-2 text-[10px] font-medium text-brand-400 bg-brand-600/20 px-1.5 py-0.5 rounded">
                          CURRENT
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {tier.pct > 0 ? (
                        <span className="text-green-400">{(tier.pct * 100).toFixed(0)}%</span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-xs text-gray-500">
          Discounts are calculated based on last month&apos;s total purchase volume (ex-VAT) and applied automatically to all catalog prices.
          Tiers reset on the 1st of each month.
        </p>
      </main>
    </>
  );
}
