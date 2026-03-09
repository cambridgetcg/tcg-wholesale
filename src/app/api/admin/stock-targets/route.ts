import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stockTargets } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  const rows = await db
    .select()
    .from(stockTargets)
    .orderBy(asc(stockTargets.priceMin));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { priceMin, priceMax, targetQty } = await req.json();
  const [row] = await db
    .insert(stockTargets)
    .values({ priceMin, priceMax, targetQty })
    .returning();
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest) {
  const { id, priceMin, priceMax, targetQty } = await req.json();
  const [row] = await db
    .update(stockTargets)
    .set({ priceMin, priceMax, targetQty })
    .where(eq(stockTargets.id, id))
    .returning();
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await db.delete(stockTargets).where(eq(stockTargets.id, id));
  return NextResponse.json({ ok: true });
}
