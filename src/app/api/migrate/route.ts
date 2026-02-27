import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

// Temporary one-off migration endpoint. DELETE THIS FILE after running.
// Usage: curl -X POST https://wholesaletcgdirect.com/api/migrate?token=<NEXTAUTH_SECRET>

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || token !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results: string[] = [];

  try {
    // 002: order_status_history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "order_status_history" (
        "id" serial PRIMARY KEY NOT NULL,
        "order_id" integer NOT NULL REFERENCES "orders"("id"),
        "from_status" text NOT NULL,
        "to_status" text NOT NULL,
        "changed_by" integer REFERENCES "clients"("id"),
        "changed_at" timestamp DEFAULT now(),
        "note" text
      )
    `);
    results.push("002: created order_status_history table");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "order_status_history_order_idx"
        ON "order_status_history" USING btree ("order_id")
    `);
    results.push("002: created order_status_history_order_idx");

    await db.execute(sql`
      ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'submitted'
    `);
    results.push("002: set orders default status to submitted");

    await db.execute(sql`
      UPDATE "orders" SET "status" = 'submitted' WHERE "status" = 'draft'
    `);
    results.push("002: migrated draft rows to submitted");

    return NextResponse.json({ ok: true, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, results, error: msg }, { status: 500 });
  }
}
