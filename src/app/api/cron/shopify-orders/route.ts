/**
 * POST /api/cron/shopify-orders
 *
 * Pull recent Shopify orders and decrement stock for any not yet processed.
 * Auth: Authorization: Bearer {CRON_SECRET}  OR  Vercel Cron header
 *
 * Query params:
 *   ?order_numbers=1186,1185  — process specific orders only
 *   ?since=2026-03-20         — orders since this date (default: 7 days)
 *
 * Deduplication: checks stock_adjustments.note for "shopify-#NNNN"
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards, stockAdjustments } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { ShopifyClient } from "@/lib/shopify-client";

function authorizeCron(req: NextRequest): boolean {
  // Vercel Cron sends this header automatically
  if (req.headers.get("x-vercel-cron") === "true") return true;

  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Bearer token
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;

  // Query param
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

export async function POST(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const orderNumbersParam = url.searchParams.get("order_numbers");
  const sinceParam = url.searchParams.get("since");

  const client = new ShopifyClient();

  const since = sinceParam
    ? new Date(sinceParam).toISOString()
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const orders = await client.getOrders({
    status: "any",
    financial_status: "any",
    created_at_min: since,
    limit: 50,
  });

  // Filter to paid/authorized orders
  const processable = orders.filter(
    (o) => o.financial_status === "paid" || o.financial_status === "authorized"
  );

  // Optionally filter to specific order numbers
  const targetNumbers = orderNumbersParam
    ? orderNumbersParam.split(",").map(Number)
    : null;

  const targetOrders = targetNumbers
    ? processable.filter((o) => targetNumbers.includes(o.order_number))
    : processable;

  const allResults: Array<{
    order_number: number;
    status: string;
    items_processed: number;
    items_skipped: number;
    items_errored: number;
    details?: Array<{ sku: string; prev: number; new: number; delta: number }>;
    errors?: Array<{ sku: string; error: string }>;
  }> = [];

  for (const order of targetOrders) {
    const orderRef = `shopify-#${order.order_number}`;

    // Check if already processed
    const existing = await db
      .select({ id: stockAdjustments.id })
      .from(stockAdjustments)
      .where(eq(stockAdjustments.note, orderRef))
      .limit(1);

    if (existing.length > 0) {
      allResults.push({
        order_number: order.order_number,
        status: "already_processed",
        items_processed: 0,
        items_skipped: order.line_items.length,
        items_errored: 0,
      });
      continue;
    }

    const details: Array<{ sku: string; prev: number; new: number; delta: number }> = [];
    const errors: Array<{ sku: string; error: string }> = [];

    for (const item of order.line_items) {
      const sku = item.sku?.trim();
      if (!sku) {
        errors.push({ sku: item.title || "unknown", error: "No SKU" });
        continue;
      }

      try {
        const [card] = await db
          .select({ id: cards.id, stock: cards.stock })
          .from(cards)
          .where(eq(cards.sku, sku))
          .limit(1);

        if (!card) {
          errors.push({ sku, error: "Not in wholesale DB" });
          continue;
        }

        const prevStock = card.stock;
        const delta = -Math.min(item.quantity, prevStock);
        const newStock = prevStock + delta;

        await db
          .update(cards)
          .set({ stock: sql`greatest(${cards.stock} - ${item.quantity}, 0)` })
          .where(eq(cards.id, card.id));

        await db.insert(stockAdjustments).values({
          cardId: card.id,
          delta,
          reason: "count",
          channel: "shopify-cambridge",
          note: orderRef,
        });

        details.push({ sku, prev: prevStock, new: newStock, delta });
      } catch (err) {
        errors.push({ sku, error: err instanceof Error ? err.message : String(err) });
      }
    }

    allResults.push({
      order_number: order.order_number,
      status: "processed",
      items_processed: details.length,
      items_skipped: 0,
      items_errored: errors.length,
      details,
      ...(errors.length > 0 && { errors }),
    });
  }

  return NextResponse.json({
    total_orders: targetOrders.length,
    results: allResults,
  });
}

// Also support GET for manual triggering / Vercel Cron
export async function GET(req: NextRequest) {
  return POST(req);
}
