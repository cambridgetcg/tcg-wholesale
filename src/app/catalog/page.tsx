import { db } from "@/lib/db";
import { cards, clients } from "@/lib/db/schema";
import { like, or, eq, asc, desc, count, max, sql, SQL } from "drizzle-orm";
import { auth } from "@/lib/auth";
import Nav from "@/components/Nav";
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

  // Get volume discount for current user
  let volumeDiscountPct = 0;
  const session = await auth();
  if (session?.user?.id) {
    const [client] = await db
      .select({ volumeDiscountPct: clients.volumeDiscountPct })
      .from(clients)
      .where(eq(clients.id, Number(session.user.id)))
      .limit(1);
    if (client) volumeDiscountPct = client.volumeDiscountPct;
  }

  // Build where conditions
  const conditions: SQL[] = [];
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(
      or(
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

  // Distinct set codes for dropdown
  const setRows = await db
    .selectDistinct({ setCode: cards.setCode })
    .from(cards);
  const sets = setRows
    .map((r) => r.setCode)
    .filter((s): s is string => !!s)
    .sort();

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
          <SearchBar sets={sets} currentQuery={query} currentSet={setFilter} />
        </div>

        {volumeDiscountPct > 0 && (
          <div className="mb-4 rounded bg-green-900/20 border border-green-800/30 px-4 py-2 text-sm text-green-400">
            Your volume discount: {(volumeDiscountPct * 100).toFixed(0)}% off all prices
          </div>
        )}

        <CardTable
          cards={allCards}
          currentSort={sortField}
          currentOrder={sortOrder}
          volumeDiscountPct={volumeDiscountPct}
        />

        <Pagination currentPage={safePage} totalPages={totalPages} />

        <p className="mt-4 text-xs text-gray-500">
          {total} card{total !== 1 ? "s" : ""} total &middot; Prices ex-VAT
        </p>
      </main>
    </>
  );
}
