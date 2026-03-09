import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function GET() {
  // Join cards with stock_targets by price range, compute to_order
  const rows = await db.execute(sql`
    SELECT
      c.id AS "cardId",
      c.card_number AS "cardNumber",
      c.name,
      c.set_code AS "setCode",
      c.image_url AS "imageUrl",
      COALESCE(c.price, 0) AS price,
      c.stock,
      c.pending_stock AS "pendingStock",
      COALESCE(st.target_qty, 0) AS "targetQty",
      GREATEST(COALESCE(st.target_qty, 0) - c.stock - c.pending_stock, 0) AS "toOrder"
    FROM cards c
    LEFT JOIN stock_targets st
      ON c.price >= st.price_min AND c.price < st.price_max
    WHERE c.category = 'singles'
      AND c.price IS NOT NULL
      AND c.price > 0
    ORDER BY
      GREATEST(COALESCE(st.target_qty, 0) - c.stock - c.pending_stock, 0) DESC,
      c.card_number ASC
  `);

  return NextResponse.json(rows);
}
