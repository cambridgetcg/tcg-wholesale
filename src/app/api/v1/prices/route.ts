import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, games } from "@/lib/db/schema";
import { eq, gte, and, sql, gt, ilike, or, asc, desc } from "drizzle-orm";
import { authenticateApiKey, unauthorized } from "../auth";

export async function GET(req: NextRequest) {
  try {
    const apiKey = await authenticateApiKey(req);
    if (!apiKey) return unauthorized();

    const params = req.nextUrl.searchParams;

    // Pagination
    const limit = Math.min(Math.max(parseInt(params.get("limit") || "48", 10) || 48, 1), 500);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

    // Existing filters
    const gameCode = params.get("game");
    const updatedSince = params.get("updated_since");

    // New filters
    const q = params.get("q");
    const sort = params.get("sort") || "card_number";
    const inStock = params.get("in_stock");
    const setCode = params.get("set");
    const category = params.get("category");
    const rarity = params.get("rarity");

    const conditions = [];

    if (gameCode) {
      const game = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.code, gameCode))
        .limit(1);
      if (!game.length) {
        return NextResponse.json({ error: `Game not found: ${gameCode}` }, { status: 404 });
      }
      conditions.push(eq(cards.gameId, game[0].id));
    }

    if (updatedSince) {
      const since = new Date(updatedSince);
      if (isNaN(since.getTime())) {
        return NextResponse.json({ error: "Invalid updated_since timestamp" }, { status: 400 });
      }
      conditions.push(gte(cards.lastSyncedAt, since));
    }

    if (q) {
      conditions.push(
        or(
          ilike(cards.cardNumber, `%${q}%`),
          ilike(cards.name, `%${q}%`),
          ilike(cards.nameEn, `%${q}%`),
        )
      );
    }

    if (inStock === "true") {
      conditions.push(gt(cards.stock, 0));
    }

    if (setCode) {
      conditions.push(eq(cards.setCode, setCode));
    }

    if (category === "singles" || category === "sealed") {
      conditions.push(eq(cards.category, category));
    }

    if (rarity) {
      conditions.push(eq(cards.rarity, rarity));
    }

    const where = conditions.length ? and(...conditions) : undefined;

    // Sorting
    let orderBy;
    switch (sort) {
      case "price_asc":
        orderBy = asc(cards.price);
        break;
      case "price_desc":
        orderBy = desc(cards.price);
        break;
      case "name_asc":
        orderBy = asc(cards.nameEn);
        break;
      case "card_number":
      default:
        orderBy = asc(cards.cardNumber);
        break;
    }

    // Count total matching rows
    const [{ count: total }] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(cards)
      .where(where);

    // Fetch page
    const rows = await db
      .select({
        sku: cards.sku,
        cardNumber: cards.cardNumber,
        priceGbp: cards.price,
        stock: cards.stock,
        pendingStock: cards.pendingStock,
        imageUrl: cards.imageUrl,
        name: cards.name,
        nameEn: cards.nameEn,
        updatedAt: cards.lastSyncedAt,
        setCode: cards.setCode,
        setName: cards.setName,
        rarity: cards.rarity,
        category: cards.category,
      })
      .from(cards)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      total,
      count: rows.length,
      limit,
      offset,
      channel: apiKey.channel,
      items: rows.map((r) => ({
        sku: r.sku,
        card_number: r.cardNumber,
        price_gbp: r.priceGbp,
        stock: r.stock,
        pending_stock: r.pendingStock,
        image_url: r.imageUrl,
        name: r.nameEn || r.name,
        name_en: r.nameEn,
        set_code: r.setCode,
        set_name: r.setName,
        rarity: r.rarity,
        category: r.category,
        updated_at: r.updatedAt,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/v1/prices] Error:", message);
    return NextResponse.json({ error: "Internal error", detail: message }, { status: 500 });
  }
}
