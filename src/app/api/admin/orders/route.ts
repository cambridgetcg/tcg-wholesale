import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, clients } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await db
    .select({
      id: orders.id,
      clientId: orders.clientId,
      clientName: clients.name,
      clientCompany: clients.company,
      status: orders.status,
      totalExVat: orders.totalExVat,
      volumeDiscount: orders.volumeDiscount,
      notes: orders.notes,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(clients, eq(orders.clientId, clients.id))
    .orderBy(desc(orders.createdAt));

  return NextResponse.json(result);
}
