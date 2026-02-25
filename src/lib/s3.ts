import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import ExcelJS from "exceljs";

const SET_NAME_MAP: Record<string, string> = {
  OP01: "Romance Dawn",
  OP02: "Paramount War",
  OP03: "Pillars of Strength",
  OP04: "Kingdoms of Intrigue",
  OP05: "Awakening of the New Era",
  OP06: "Wings of the Captain",
  OP07: "500 Years in the Future",
  OP08: "Two Legends",
  OP09: "The Four Emperors",
};

export function getSetName(setCode: string): string {
  return SET_NAME_MAP[setCode] ?? setCode;
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || "eu-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function fetchPriceFeed(): Promise<CardPriceRow[]> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET || "pricedata-tcg",
    Key: process.env.S3_PRICE_FEED_KEY || "pricefeed/onepiece_pricefeed.xlsx",
  });

  const response = await s3.send(command);
  const bytes = await response.Body!.transformToByteArray();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

  // First sheet contains: sku, latest JPY price, base_cost, total_cost, selling_price, gbp_to_jpy, ebay_item_number
  // Sheet names: ebay_business, ebay_private, cardmarket, cardtrader, shopify
  // Use first sheet (ebay_business) as canonical source
  const sheet = workbook.worksheets[0];
  const rows: CardPriceRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const sku = row.getCell(1).value?.toString() || "";
    const cardrushJpy = Number(row.getCell(2).value) || 0;
    const gbpToJpy = Number(row.getCell(6).value) || 208.53;
    const ebayItemNumber = row.getCell(7).value?.toString() || "";

    if (sku && cardrushJpy > 0) {
      // Extract card number and set code from SKU: OP-OP01-001-JP → card: OP01-001, set: OP01
      const parts = sku.replace("OP-", "").replace("-JP", "").split("-");
      const setCode = parts[0] || "";
      const cardNumber = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : sku;

      const setName = getSetName(setCode);
      rows.push({ sku, cardNumber, setCode, setName, cardrushJpy, gbpToJpy, ebayItemNumber });
    }
  });

  return rows;
}

export function parseSkuGame(sku: string): string {
  if (sku.startsWith("OP-")) return "onepiece";
  // Future: PKM-, YGO-, DBS- patterns
  return "unknown";
}

export interface CardPriceRow {
  sku: string;
  cardNumber: string;
  setCode: string;
  setName: string;
  cardrushJpy: number;
  gbpToJpy: number;
  ebayItemNumber: string;
}
