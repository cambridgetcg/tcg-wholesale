import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cartItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = parseInt(session.user.id);
  const rows = await db
    .select()
    .from(cartItems)
    .where(eq(cartItems.clientId, clientId));

  const items = rows.map((r) => ({
    card: {
      id: r.cardId,
      cardNumber: r.cardNumber,
      sku: r.sku,
      name: r.cardName,
      setCode: r.setCode,
      setName: r.setName,
      priceExVat: r.priceExVat,
    },
    quantity: r.quantity,
  }));

  return NextResponse.json(items);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = parseInt(session.user.id);
  const body = (await req.json()) as {
    items: {
      card: {
        id: number;
        cardNumber: string;
        sku: string;
        name: string;
        setCode: string | null;
        setName: string | null;
        priceExVat: number;
      };
      quantity: number;
    }[];
  };

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(cartItems).where(eq(cartItems.clientId, clientId));

    if (body.items.length > 0) {
      await tx.insert(cartItems).values(
        body.items.map((item) => ({
          clientId,
          cardId: item.card.id,
          quantity: item.quantity,
          cardNumber: item.card.cardNumber,
          sku: item.card.sku,
          cardName: item.card.name,
          setCode: item.card.setCode,
          setName: item.card.setName,
          priceExVat: item.card.priceExVat,
          addedAt: now,
          updatedAt: now,
        }))
      );
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = parseInt(session.user.id);
  await db.delete(cartItems).where(eq(cartItems.clientId, clientId));

  return NextResponse.json({ ok: true });
}
