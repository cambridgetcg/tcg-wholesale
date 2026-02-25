import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";
import Nav from "@/components/Nav";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim();

  let allCards;
  if (query) {
    const pattern = `%${query}%`;
    allCards = await db
      .select()
      .from(cards)
      .where(
        or(
          like(cards.cardNumber, pattern),
          like(cards.name, pattern),
          like(cards.setName, pattern),
          like(cards.setCode, pattern)
        )
      )
      .orderBy(cards.cardNumber);
  } else {
    allCards = await db.select().from(cards).orderBy(cards.cardNumber);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Card Catalog</h1>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search cards..."
              className="rounded bg-[#12121a] border border-[#1e1e2e] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none w-64"
            />
            <button type="submit" className="rounded bg-brand-600 px-4 py-1.5 text-sm hover:bg-brand-700 transition">
              Search
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#1e1e2e]">
          <table className="w-full text-sm">
            <thead className="bg-[#12121a]">
              <tr className="text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Card #</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Set</th>
                <th className="px-4 py-3 font-medium text-right">JPY</th>
                <th className="px-4 py-3 font-medium text-right">Price (ex-VAT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {allCards.map((card) => (
                <tr key={card.id} className="hover:bg-[#12121a] transition">
                  <td className="px-4 py-3 font-mono text-brand-500">{card.cardNumber}</td>
                  <td className="px-4 py-3">{card.name}</td>
                  <td className="px-4 py-3 text-gray-400">{card.setName}</td>
                  <td className="px-4 py-3 text-right text-gray-400">¥{card.cardrushJpy.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-400">
                    £{card.priceExVat.toFixed(2)}
                  </td>
                </tr>
              ))}
              {allCards.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No cards found{query ? ` for "${query}"` : ""}. Run the seed script or sync from S3.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-gray-500">{allCards.length} cards • Prices updated from CardRush daily</p>
      </main>
    </>
  );
}
