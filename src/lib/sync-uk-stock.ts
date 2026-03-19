import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

/**
 * Sync UK warehouse stock into cards.stock and cards.pending_stock.
 *
 * stock         = received purchase qty - fulfilled qty  (on-hand in UK)
 * pending_stock = ordered/shipped purchase qty           (in transit)
 */
export async function syncUkStock(cardIds?: number[]) {
  const scope = cardIds?.length ? sql`AND c.id = ANY(${cardIds})` : sql``;
  const scopeNoAlias = cardIds?.length ? sql`AND id = ANY(${cardIds})` : sql``;

  // On-hand stock: only received Mint purchases (exclude A- condition)
  await db.execute(sql`
    UPDATE cards c
    SET stock = COALESCE(uk.qty_on_hand, 0)
    FROM (
      SELECT
        p.card_id,
        GREATEST(SUM(p.qty_purchased) - COALESCE(f.qty_fulfilled, 0), 0)::int AS qty_on_hand
      FROM (
        SELECT pi.card_id, SUM(pi.quantity) AS qty_purchased
        FROM purchase_items pi
        JOIN purchases pu ON pu.id = pi.purchase_id
        WHERE pu.status = 'received' AND pi.condition NOT LIKE '状態%'
        GROUP BY pi.card_id
      ) p
      LEFT JOIN (
        SELECT oi.card_id, SUM(fe.fulfilled_qty) AS qty_fulfilled
        FROM fulfillment_entries fe
        JOIN order_items oi ON oi.id = fe.order_item_id AND oi.removed_at IS NULL
        GROUP BY oi.card_id
      ) f ON f.card_id = p.card_id
      GROUP BY p.card_id, f.qty_fulfilled
    ) uk
    WHERE c.id = uk.card_id ${scope}
  `);

  // Zero out on-hand for cards with no received Mint purchases
  await db.execute(sql`
    UPDATE cards SET stock = 0
    WHERE stock != 0
    AND id NOT IN (
      SELECT pi.card_id FROM purchase_items pi
      JOIN purchases pu ON pu.id = pi.purchase_id
      WHERE pu.status = 'received' AND pi.condition NOT LIKE '状態%'
    )
    ${scopeNoAlias}
  `);

  // Pending stock: ordered or shipped Mint only (exclude A- condition)
  await db.execute(sql`
    UPDATE cards c
    SET pending_stock = COALESCE(pk.qty_pending, 0)
    FROM (
      SELECT pi.card_id, SUM(pi.quantity)::int AS qty_pending
      FROM purchase_items pi
      JOIN purchases pu ON pu.id = pi.purchase_id
      WHERE pu.status IN ('ordered', 'shipped') AND pi.condition NOT LIKE '状態%'
      GROUP BY pi.card_id
    ) pk
    WHERE c.id = pk.card_id ${scope}
  `);

  // Zero out pending for cards with no ordered/shipped Mint purchases
  await db.execute(sql`
    UPDATE cards SET pending_stock = 0
    WHERE pending_stock != 0
    AND id NOT IN (
      SELECT pi.card_id FROM purchase_items pi
      JOIN purchases pu ON pu.id = pi.purchase_id
      WHERE pu.status IN ('ordered', 'shipped') AND pi.condition NOT LIKE '状態%'
    )
    ${scopeNoAlias}
  `);
}
