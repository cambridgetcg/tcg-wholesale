import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

/** PATCH /api/admin/stock/adjust — Set stock for a card */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { cardId, stock } = (await req.json()) as { cardId: number; stock: number };

  if (typeof cardId !== "number" || typeof stock !== "number" || stock < 0) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const [updated] = await db
    .update(cards)
    .set({ stock: Math.floor(stock) })
    .where(eq(cards.id, cardId))
    .returning({ id: cards.id, stock: cards.stock });

  return NextResponse.json(updated);
}
