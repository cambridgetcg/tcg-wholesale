import { Suspense } from "react";
import { db } from "@/lib/db";
import { cards, games, sets as setsTable } from "@/lib/db/schema";
import { like, or, eq, asc, desc, count, max, sql, SQL } from "drizzle-orm";
import { getVolumeDiscountInfo } from "@/lib/get-volume-discount";
import Nav from "@/components/Nav";
import Link from "next/link";
import GameTabs from "@/components/catalog/GameTabs";
import CategoryToggle from "@/components/catalog/CategoryToggle";
import SearchBar from "@/components/catalog/SearchBar";
import CardTable from "@/components/catalog/CardTable";
import Pagination from "@/components/catalog/Pagination";

const PER_PAGE = 50;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    game?: string;
    set?: string;
    category?: string;
    sort?: string;
    order?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const gameFilter = params.game?.trim() || "";
  const setFilter = params.set?.trim() || "";
  const categoryFilter = params.category?.trim() || "singles";
  const sortField = params.sort || "cardNumber";
  const sortOrder = params.order === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  // Get volume discount info for current user (cached per request)
  const discountInfo = await getVolumeDiscountInfo();
  const volumeDiscountPct = discountInfo.volumeDiscountPct;

  // Fetch all games for tabs
  const allGames = await db
    .select()
    .from(games)
    .orderBy(asc(games.sortOrder));

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

  // Game filter
  if (gameFilter) {
    const game = allGames.find(g => g.code === gameFilter);
    if (game) conditions.push(eq(cards.gameId, game.id));
  }

  // Set filter
  if (setFilter) {
    conditions.push(eq(cards.setCode, setFilter));
  }

  // Category filter
  conditions.push(eq(cards.category, categoryFilter as "singles" | "sealed"));

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

  // Sets for dropdown (code + name from sets table, filtered by game)
  const setConditions: SQL[] = [];
  if (gameFilter) {
    const game = allGames.find(g => g.code === gameFilter);
    if (game) setConditions.push(eq(setsTable.gameId, game.id));
  }
  const setRows = await db
    .select({ code: setsTable.code, name: setsTable.name })
    .from(setsTable)
    .where(setConditions.length ? setConditions[0] : undefined)
    .orderBy(desc(setsTable.sortOrder));
  const sets = setRows.map((r) => ({ code: r.code, name: r.name }));

  // Last synced timestamp
  const [{ lastSynced }] = await db
    .select({ lastSynced: max(cards.lastSyncedAt) })
    .from(cards);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Card Catalog</h1>
            {lastSynced && (
              <p className="mt-1 text-xs text-gray-500">
                Last synced: {new Date(lastSynced).toLocaleString("en-GB")}
              </p>
            )}
          </div>
        </div>

        {/* Game tabs */}
        <Suspense>
          <GameTabs
            games={allGames.map(g => ({ code: g.code, name: g.name, active: g.active ?? true }))}
            currentGame={gameFilter}
          />
        </Suspense>

        {/* Category toggle + search/set filters */}
        <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-4">
          <Suspense>
            <CategoryToggle currentCategory={categoryFilter} />
          </Suspense>
          <Suspense>
            <SearchBar sets={sets} currentQuery={query} currentSet={setFilter} />
          </Suspense>
        </div>

        {/* Discount banner */}
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
