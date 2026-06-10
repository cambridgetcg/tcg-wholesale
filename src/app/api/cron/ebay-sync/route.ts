/**
 * GET /api/cron/ebay-sync
 *
 * Vercel cron handler -- runs every 6 hours (see vercel.json).
 * Auth: Authorization: Bearer {CRON_SECRET}  OR  ?secret={CRON_SECRET}
 *
 * Pulls recent eBay orders, then pushes price + stock for all active
 * listings to eBay.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, games } from "@/lib/db/schema";
import { gt } from "drizzle-orm";
import { pullOrders, bulkPushListings } from "@/lib/channels/ebay";

export const maxDuration = 300; // 5-minute Vercel function timeout

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    (authHeader !== `Bearer ${cronSecret}` && secret !== cronSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTs = new Date().toISOString();
  console.log(`[cron/ebay-sync] Starting sync at ${startTs}`);

  try {
    // 1. Pull orders from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ordersResult = await pullOrders(since);

    if (!ordersResult.ok) {
      console.error("[cron/ebay-sync] Failed to pull orders:", ordersResult.error);
      return NextResponse.json(
        { ok: false, error: ordersResult.error },
        { status: 502 },
      );
    }

    console.log(
      `[cron/ebay-sync] Pulled ${ordersResult.data.length} orders since ${since.toISOString()}`,
    );

    // 2. Push all in-stock priced cards to eBay
    const rows = await db
      .select({
        sku: cards.sku,
        price: cards.price,
        stock: cards.stock,
      })
      .from(cards)
      .innerJoin(games, gt(cards.gameId, 0))
      .where(gt(cards.stock, 0));

    const items = rows
      .filter((r) => r.price && r.price > 0)
      .map((r) => ({
        sku: r.sku,
        priceGbp: r.price!,
        stock: r.stock,
      }));

    const pushResult = await bulkPushListings(items);

    const endTs = new Date().toISOString();

    if (!pushResult.ok) {
      console.error("[cron/ebay-sync] Failed to push listings:", pushResult.error);
      return NextResponse.json(
        { ok: false, error: pushResult.error },
        { status: 502 },
      );
    }

    console.log(
      `[cron/ebay-sync] Completed at ${endTs} -- pushed ${pushResult.data.pushed}, errors ${pushResult.data.errors.length}`,
    );

    return NextResponse.json({
      ok: true,
      startTs,
      endTs,
      ordersPulled: ordersResult.data.length,
      listingsPushed: pushResult.data.pushed,
      pushErrors: pushResult.data.errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[cron/ebay-sync] Failed:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
