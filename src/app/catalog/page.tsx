import { Suspense } from "react";
import { db } from "@/lib/db";
import { cards, sets as setsTable } from "@/lib/db/schema";
import { like, or, eq, asc, desc, count, max, sql, SQL } from "drizzle-orm";
import { getVolumeDiscountInfo } from "@/lib/get-volume-discount";
import Nav from "@/components/Nav";
import Link from "next/link";
import SearchBar from "@/components/catalog/SearchBar";
import CardTable from "@/components/catalog/CardTable";
import Pagination from "@/components/catalog/Pagination";

const PER_PAGE = 50;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    set?: string;
    sort?: string;
    order?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const setFilter = params.set?.trim() || "";
  const sortField = params.sort || "cardNumber";
  const sortOrder = params.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  // Get volume discount info for current user (cached per request)
  const discountInfo = await getVolumeDiscountInfo();
  const volumeDiscountPct = discountInfo.volumeDiscountPct;

  // Build where conditions
  const conditions: SQL[] = [];
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      or(
        like(cards.name, pattern),
        like(cards.cardNumber, pattern),
        like(cards.sku, pattern)
      )!
    );
  }
  if (setFilter) {
    conditions.push(eq(cards.setCode, setFilter));
  }

  const whereClause = conditions.length > 0
    ? conditions.reduce((a, b) => {
        return sql`${a} AND ${b}`;
      })
    : undefined;

  // Sort column
  const sortColumn = sortField === "price" ? cards.priceExVat : cards.cardNumber;
  const orderBy = sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn);

  // Count total matching rows
  const [{ total }] = await db
    .select({ total: count() })
    .from(cards)
    .where(whereClause);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, totalPages);

  // Fetch paginated cards
  const allCards = await db
    .select()
    .from(cards)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(PER_PAGE)
    .offset((safePage - 1) * PER_PAGE);

  // Sets for dropdown (code + name from sets table)
  const setRows = await db
    .select({ code: setsTable.code, name: setsTable.name })
    .from(setsTable)
    .orderBy(asc(setsTable.code));
  const sets = setRows.map((r) => ({ code: r.code, name: r.name }));

  // Last synced timestamp
  const [{ lastSynced }] = await db
    .select({ lastSynced: max(cards.lastSyncedAt) })
    .from(cards);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Card Catalog</h1>
            {lastSynced && (
              <p className="mt-1 text-xs text-gray-500">
                Last synced: {new Date(lastSynced).toLocaleString("en-GB")}
              </p>
            )}
          </div>
          <Suspense>
            <SearchBar sets={sets} currentQuery={query} currentSet={setFilter} />
          </Suspense>
        </div>

        {volumeDiscountPct > 0 ? (
          <div className="mb-4 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-3 text-sm">
            <span className="text-gray-400">
              Your discount:{" "}
              <span className="font-semibold text-green-400">{(volumeDiscountPct * 100).toFixed(0)}%</span>
              {" "}off all prices
            </span>
            <Link href="/discount" className="ml-3 text-brand-400 hover:text-brand-300 transition">
              View tiers &rarr;
            </Link>
          </div>
        ) : (
          <div className="mb-4 rounded-lg border border-[#1e1e2e] bg-[#12121a] px-4 py-3 text-sm">
            <span className="text-gray-400">
              Volume discounts available &mdash;{" "}
            </span>
            <Link href="/discount" className="text-brand-400 hover:text-brand-300 transition">
              See how to save &rarr;
            </Link>
          </div>
        )}

        <Suspense>
          <CardTable
            cards={allCards}
            currentSort={sortField}
            currentOrder={sortOrder}
            volumeDiscountPct={volumeDiscountPct}
          />
        </Suspense>

        <Suspense>
          <Pagination currentPage={safePage} totalPages={totalPages} />
        </Suspense>

        <p className="mt-4 text-xs text-gray-500">
          {total} card{total !== 1 ? "s" : ""} total &middot; Prices ex-VAT
        </p>
      </main>
    </>
  );
}
