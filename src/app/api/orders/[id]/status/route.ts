import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

const validStatuses = ["draft", "submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json() as { status: string };
  if (!validStatuses.includes(status as typeof validStatuses[number])) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const [updated] = await db
    .update(orders)
    .set({ status: status as typeof validStatuses[number], updatedAt: new Date().toISOString() })
    .where(eq(orders.id, parseInt(id)))
    .returning();

  return NextResponse.json(updated);
}
