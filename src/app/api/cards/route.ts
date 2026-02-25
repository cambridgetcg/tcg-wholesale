import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cards } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  let result;
  if (q) {
    const pattern = `%${q}%`;
    result = await db
      .select()
      .from(cards)
      .where(or(like(cards.cardNumber, pattern), like(cards.name, pattern), like(cards.setName, pattern)))
      .orderBy(cards.cardNumber);
  } else {
    result = await db.select().from(cards).orderBy(cards.cardNumber);
  }

  return NextResponse.json(result);
}
