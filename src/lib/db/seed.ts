import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { hashSync } from "bcryptjs";
import { clients, cards } from "./schema";

const dbPath = process.env.DATABASE_URL || "./data/tcg.db";
mkdirSync("data", { recursive: true });

const client = createClient({ url: `file:${dbPath}` });
const db = drizzle(client);

async function seed() {
  // Create tables
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      company TEXT,
      role TEXT NOT NULL DEFAULT 'client',
      current_month_spend REAL NOT NULL DEFAULT 0,
      prior_month_spend REAL NOT NULL DEFAULT 0,
      volume_discount_pct REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      set_code TEXT NOT NULL,
      set_name TEXT NOT NULL,
      cardrush_url TEXT,
      cardrush_jpy REAL NOT NULL,
      base_gbp REAL NOT NULL,
      price_ex_vat REAL NOT NULL,
      last_synced_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      status TEXT NOT NULL DEFAULT 'draft',
      total_ex_vat REAL NOT NULL DEFAULT 0,
      volume_discount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      card_id INTEGER NOT NULL REFERENCES cards(id),
      quantity INTEGER NOT NULL,
      unit_price_ex_vat REAL NOT NULL,
      line_total REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      date TEXT NOT NULL,
      cardrush_jpy REAL NOT NULL,
      gbp_jpy_rate REAL NOT NULL
    );
  `);

  const now = new Date().toISOString();

  // Seed admin
  await db.insert(clients).values({
    name: "Admin",
    email: "admin@tcg-wholesale.co.uk",
    passwordHash: hashSync("admin123", 10),
    company: "TCG Wholesale Ltd",
    role: "admin",
    currentMonthSpend: 0,
    priorMonthSpend: 0,
    volumeDiscountPct: 0,
    createdAt: now,
  }).onConflictDoNothing();

  // Seed test client
  await db.insert(clients).values({
    name: "Test Client",
    email: "client@example.com",
    passwordHash: hashSync("client123", 10),
    company: "StreamerCo",
    role: "client",
    currentMonthSpend: 0,
    priorMonthSpend: 25000,
    volumeDiscountPct: 4,
    createdAt: now,
  }).onConflictDoNothing();

  // Seed sample cards
  const rate = 208.53;
  const sampleCards = [
    { cardNumber: "OP01-001", sku: "OP-OP01-001-JP", name: "Roronoa Zoro (Leader)", setCode: "OP01", setName: "Romance Dawn", jpy: 17800 },
    { cardNumber: "OP01-002", sku: "OP-OP01-002-JP", name: "Nami", setCode: "OP01", setName: "Romance Dawn", jpy: 2500 },
    { cardNumber: "OP01-003", sku: "OP-OP01-003-JP", name: "Usopp", setCode: "OP01", setName: "Romance Dawn", jpy: 1200 },
    { cardNumber: "OP02-001", sku: "OP-OP02-001-JP", name: "Monkey D. Luffy (Leader)", setCode: "OP02", setName: "Paramount War", jpy: 22000 },
    { cardNumber: "OP02-002", sku: "OP-OP02-002-JP", name: "Portgas D. Ace", setCode: "OP02", setName: "Paramount War", jpy: 8500 },
    { cardNumber: "OP03-001", sku: "OP-OP03-001-JP", name: "Boa Hancock (Leader)", setCode: "OP03", setName: "Pillars of Strength", jpy: 15000 },
    { cardNumber: "OP03-002", sku: "OP-OP03-002-JP", name: "Crocodile", setCode: "OP03", setName: "Pillars of Strength", jpy: 6200 },
    { cardNumber: "OP04-001", sku: "OP-OP04-001-JP", name: "Kaido (Leader)", setCode: "OP04", setName: "Kingdoms of Intrigue", jpy: 19500 },
  ];

  for (const c of sampleCards) {
    const baseGbp = c.jpy / rate;
    const shipping = baseGbp * 0.05;
    const landed = baseGbp + shipping;
    const margin = landed * 0.20;
    const priceExVat = landed + margin;

    await db.insert(cards).values({
      cardNumber: c.cardNumber,
      sku: c.sku,
      name: c.name,
      setCode: c.setCode,
      setName: c.setName,
      cardrushUrl: `https://www.cardrush-op.jp/product/${c.cardNumber}`,
      cardrushJpy: c.jpy,
      baseGbp: Math.round(baseGbp * 100) / 100,
      priceExVat: Math.round(priceExVat * 100) / 100,
      lastSyncedAt: now,
    }).onConflictDoNothing();
  }

  console.log("✅ Seeded database with admin, test client, and 8 sample cards");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
