/**
 * POST /api/cron/stock-correct
 *
 * Reverse a shopify order's stock adjustments (undo a decrement).
 * Auth: CRON_SECRET
 *
 * Body: { "reverse_order": 1185 }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, stockAdjustments } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";

function authorizeCron(req: NextRequest): boolean {
  if (req.headers.get("x-vercel-cron") === "true") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return false;
}

export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orderNumber = body.reverse_order;

  if (!orderNumber) {
    return NextResponse.json({ error: "Missing reverse_order" }, { status: 400 });
  }

  const orderRef = `shopify-#${orderNumber}`;

  // Find all adjustments for this order
  const adjustments = await db
    .select({
      id: stockAdjustments.id,
      cardId: stockAdjustments.cardId,
      delta: stockAdjustments.delta,
    })
    .from(stockAdjustments)
    .where(eq(stockAdjustments.note, orderRef));

  if (adjustments.length === 0) {
    return NextResponse.json({ error: `No adjustments found for ${orderRef}` }, { status: 404 });
  }

  const results: Array<{ cardId: number; reversed_delta: number }> = [];

  for (const adj of adjustments) {
    if (adj.delta === 0) continue; // nothing to reverse

    const reverseDelta = -adj.delta; // flip the sign

    // Add stock back
    await db
      .update(cards)
      .set({ stock: sql`${cards.stock} + ${reverseDelta}` })
      .where(eq(cards.id, adj.cardId));

    // Log the reversal
    await db.insert(stockAdjustments).values({
      cardId: adj.cardId,
      delta: reverseDelta,
      reason: "correction",
      channel: "shopify-cambridge",
      note: `reversal-${orderRef}`,
    });

    results.push({ cardId: adj.cardId, reversed_delta: reverseDelta });
  }

  // Delete the original adjustments so the order can be re-processed if needed
  for (const adj of adjustments) {
    await db.delete(stockAdjustments).where(eq(stockAdjustments.id, adj.id));
  }

  return NextResponse.json({
    order_ref: orderRef,
    reversed: results.length,
    skipped_zero: adjustments.length - results.length,
    results,
  });
}
