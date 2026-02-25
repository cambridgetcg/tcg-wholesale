import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cards, priceHistory } from "@/lib/db/schema";
import { fetchPriceFeed } from "@/lib/s3";
import { calculatePrice } from "@/lib/pricing";
import ExcelJS from "exceljs";

export async function POST() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await fetchPriceFeed();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) return NextResponse.json({ error: "No worksheet found" }, { status: 400 });

    let synced = 0;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    sheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // skip header
      const sku = String(row.getCell(1).value || "").trim();
      const jpy = Number(row.getCell(2).value) || 0;
      const gbpJpyRate = Number(row.getCell(6).value) || 208.53;

      if (!sku || !jpy) return;

      const { baseGbp, priceExVat } = calculatePrice(jpy, gbpJpyRate);
      const cardNumber = sku.replace("OP-", "").replace("-JP", "");
      const setCode = cardNumber.split("-")[0] || "OP01";

      db.insert(cards)
        .values({
          cardNumber,
          sku,
          name: cardNumber,
          setCode,
          setName: setCode,
          cardrushJpy: jpy,
          baseGbp,
          priceExVat,
          lastSyncedAt: now,
        })
        .onConflictDoUpdate({
          target: cards.sku,
          set: { cardrushJpy: jpy, baseGbp, priceExVat, lastSyncedAt: now },
        })
        .run();

      synced++;
    });

    return NextResponse.json({ synced, timestamp: now });
  } catch (error) {
    return NextResponse.json({ error: "Sync failed", details: String(error) }, { status: 500 });
  }
}
