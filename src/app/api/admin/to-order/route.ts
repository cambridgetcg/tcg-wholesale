import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

/**
 * Pipeline: deduce "to be ordered" items from supplier.
 *
 * For each order_item in paid+ orders:
 *   remaining_to_fulfill = ordered_qty - fulfilled_qty
 *   already_purchased    = SUM(purchase_items.quantity) linked to this order_item
 *   to_order             = remaining_to_fulfill - already_purchased  (clamped ≥ 0)
 *
 * Returns items where remaining_to_fulfill > 0, with all intermediate values
 * so the UI can show the full pipeline.
 */
export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await db.execute(sql`
    WITH order_scope AS (
      SELECT
        oi.id AS item_id,
        oi.order_id,
        oi.card_id,
        oi.quantity AS ordered_qty,
        oi.unit_price,
        oi.remambo_submitted_at
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status IN ('paid', 'ordered', 'shipped', 'delivered')
        AND oi.removed_at IS NULL
    ),
    fulfilled AS (
      SELECT order_item_id, SUM(fulfilled_qty)::int AS qty
      FROM fulfillment_entries
      GROUP BY order_item_id
    ),
    purchased AS (
      SELECT pi.order_item_id, SUM(pi.quantity)::int AS qty
      FROM purchase_items pi
      JOIN purchases p ON p.id = pi.purchase_id
      GROUP BY pi.order_item_id
    )
    SELECT
      os.item_id,
      os.order_id,
      os.card_id,
      c.card_number,
      c.sku,
      c.image_url,
      os.ordered_qty,
      os.unit_price::float AS unit_price,
      COALESCE(f.qty, 0) AS fulfilled_qty,
      COALESCE(p.qty, 0) AS purchased_qty,
      os.remambo_submitted_at,
      os.ordered_qty - COALESCE(f.qty, 0) AS remaining_qty,
      GREATEST(os.ordered_qty - COALESCE(f.qty, 0) - COALESCE(p.qty, 0), 0) AS to_order_qty
    FROM order_scope os
    JOIN cards c ON c.id = os.card_id
    LEFT JOIN fulfilled f ON f.order_item_id = os.item_id
    LEFT JOIN purchased p ON p.order_item_id = os.item_id
    WHERE os.ordered_qty - COALESCE(f.qty, 0) > 0
    ORDER BY os.order_id, c.card_number
  `);

  return NextResponse.json(rows);
}
