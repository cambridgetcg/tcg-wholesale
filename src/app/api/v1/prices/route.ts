import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, games, channelApiKeys } from "@/lib/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { createHash } from "crypto";

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

async function authenticateApiKey(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7);
  if (!rawKey) return null;

  const keyHash = hashKey(rawKey);
  const [row] = await db
    .select()
    .from(channelApiKeys)
    .where(eq(channelApiKeys.keyHash, keyHash))
    .limit(1);

  if (!row) return null;

  // Update lastUsedAt (fire-and-forget)
  db.update(channelApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(channelApiKeys.id, row.id))
    .execute()
    .catch(() => {});

  return row;
}

export async function GET(req: NextRequest) {
  const apiKey = await authenticateApiKey(req);
  if (!apiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gameCode = req.nextUrl.searchParams.get("game");
  const updatedSince = req.nextUrl.searchParams.get("updated_since");

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

  const where = conditions.length ? and(...conditions) : undefined;

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
    })
    .from(cards)
    .where(where)
    .orderBy(cards.sku)
    .limit(1000);

  return NextResponse.json({
    count: rows.length,
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
      updated_at: r.updatedAt,
    })),
  });
}
