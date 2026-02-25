import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cards, games, sets, priceHistory } from "@/lib/db/schema";
import { fetchPriceFeed, parseSkuGame } from "@/lib/s3";
import { calculatePrice } from "@/lib/pricing";
import { eq } from "drizzle-orm";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await fetchPriceFeed();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    let synced = 0;

    // Get-or-create the game record
    const gameCode = "onepiece"; // all current data is One Piece
    let game = await db.select().from(games).where(eq(games.code, gameCode)).get();
    if (!game) {
      await db.insert(games).values({
        code: "onepiece", name: "One Piece", slug: "one-piece", active: true, sortOrder: 0,
      }).run();
      game = await db.select().from(games).where(eq(games.code, gameCode)).get();
    }

    const setCache = new Map<string, number>();

    for (const row of rows) {
      const price = calculatePrice(row.cardrushJpy, row.gbpToJpy);

      // Get-or-create the set record
      if (!setCache.has(row.setCode)) {
        let set = await db.select().from(sets).where(eq(sets.code, row.setCode)).get();
        if (!set) {
          await db.insert(sets).values({
            gameId: game!.id, code: row.setCode, name: row.setName, sortOrder: 0,
          }).run();
          set = await db.select().from(sets).where(eq(sets.code, row.setCode)).get();
        }
        setCache.set(row.setCode, set!.id);
      }

      await db.insert(cards)
        .values({
          cardNumber: row.cardNumber,
          sku: row.sku,
          name: row.cardNumber,
          setCode: row.setCode,
          setName: row.setName,
          cardrushJpy: row.cardrushJpy,
          gbpJpyRate: row.gbpToJpy,
          baseGbp: price.baseGbp,
          priceExVat: price.priceExVat,
          ebayItemNumber: row.ebayItemNumber,
          lastSyncedAt: now,
          gameId: game!.id,
          setId: setCache.get(row.setCode)!,
          category: "singles" as const,
        })
        .onConflictDoUpdate({
          target: cards.sku,
          set: {
            cardrushJpy: row.cardrushJpy,
            gbpJpyRate: row.gbpToJpy,
            baseGbp: price.baseGbp,
            priceExVat: price.priceExVat,
            ebayItemNumber: row.ebayItemNumber,
            lastSyncedAt: now,
            gameId: game!.id,
            setId: setCache.get(row.setCode)!,
            category: "singles" as const,
          },
        })
        .run();

      // Get the card ID for price history
      const card = await db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.sku, row.sku))
        .get();

      if (card) {
        await db.insert(priceHistory)
          .values({
            cardId: card.id,
            date: today,
            cardrushJpy: row.cardrushJpy,
            gbpJpyRate: row.gbpToJpy,
          })
          .onConflictDoUpdate({
            target: [priceHistory.cardId, priceHistory.date],
            set: {
              cardrushJpy: row.cardrushJpy,
              gbpJpyRate: row.gbpToJpy,
            },
          })
          .run();
      }

      synced++;
    }

    return NextResponse.json({ synced, timestamp: now });
  } catch (error) {
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 },
    );
  }
}
