import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { priceExVat } = await req.json() as { priceExVat: number };

  const [updated] = await db
    .update(cards)
    .set({ priceExVat, lastSyncedAt: new Date().toISOString() })
    .where(eq(cards.id, parseInt(id)))
    .returning();

  return NextResponse.json(updated);
}
