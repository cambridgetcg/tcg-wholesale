import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { hashSync } from "bcryptjs";
import { clients, cards } from "./schema";
import { calculatePrice } from "../pricing";

const dbPath = process.env.DATABASE_URL || "./data/tcg.db";
mkdirSync("data", { recursive: true });

const client = createClient({ url: `file:${dbPath}` });
const db = drizzle(client);

async function seed() {
  // Create tables via drizzle push (schema already defined), but ensure they exist for raw seed
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
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_number TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT '',
      set_code TEXT,
      set_name TEXT,
      cardrush_url TEXT,
      cardrush_jpy INTEGER,
      gbp_jpy_rate REAL,
      base_gbp REAL,
      price_ex_vat REAL,
      ebay_item_number TEXT,
      last_synced_at TEXT
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      status TEXT NOT NULL DEFAULT 'draft',
      total_ex_vat REAL NOT NULL DEFAULT 0,
      volume_discount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      card_id INTEGER NOT NULL REFERENCES cards(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price_ex_vat REAL NOT NULL,
      line_total REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      date TEXT NOT NULL,
      cardrush_jpy INTEGER NOT NULL,
      gbp_jpy_rate REAL NOT NULL
    );
  `);

  // Seed admin
  await db.insert(clients).values({
    name: "Admin",
    email: "admin@cambridgetcg.com",
    passwordHash: hashSync("admin123", 10),
    company: "Cambridge TCG",
    role: "admin",
    currentMonthSpend: 0,
    priorMonthSpend: 0,
    volumeDiscountPct: 0,
  }).onConflictDoNothing();

  // Seed test client
  await db.insert(clients).values({
    name: "Test Client",
    email: "client@streamer.com",
    passwordHash: hashSync("client123", 10),
    company: "StreamerCo",
    role: "client",
    currentMonthSpend: 0,
    priorMonthSpend: 25000,
    volumeDiscountPct: 4,
  }).onConflictDoNothing();

  // Seed 10 sample One Piece cards with realistic JPY prices
  const rate = 208.53;
  const sampleCards = [
    { cardNumber: "OP01-001", sku: "OP-OP01-001-JP", name: "Roronoa Zoro (Leader)", setCode: "OP01", setName: "Romance Dawn", jpy: 17800 },
    { cardNumber: "OP01-002", sku: "OP-OP01-002-JP", name: "Nami", setCode: "OP01", setName: "Romance Dawn", jpy: 2500 },
    { cardNumber: "OP01-003", sku: "OP-OP01-003-JP", name: "Usopp", setCode: "OP01", setName: "Romance Dawn", jpy: 1200 },
    { cardNumber: "OP01-060", sku: "OP-OP01-060-JP", name: "Shanks", setCode: "OP01", setName: "Romance Dawn", jpy: 9800 },
    { cardNumber: "OP02-001", sku: "OP-OP02-001-JP", name: "Monkey D. Luffy (Leader)", setCode: "OP02", setName: "Paramount War", jpy: 22000 },
    { cardNumber: "OP02-002", sku: "OP-OP02-002-JP", name: "Portgas D. Ace", setCode: "OP02", setName: "Paramount War", jpy: 8500 },
    { cardNumber: "OP03-001", sku: "OP-OP03-001-JP", name: "Boa Hancock (Leader)", setCode: "OP03", setName: "Pillars of Strength", jpy: 15000 },
    { cardNumber: "OP03-002", sku: "OP-OP03-002-JP", name: "Crocodile", setCode: "OP03", setName: "Pillars of Strength", jpy: 6200 },
    { cardNumber: "OP04-001", sku: "OP-OP04-001-JP", name: "Kaido (Leader)", setCode: "OP04", setName: "Kingdoms of Intrigue", jpy: 19500 },
    { cardNumber: "OP04-044", sku: "OP-OP04-044-JP", name: "Yamato", setCode: "OP04", setName: "Kingdoms of Intrigue", jpy: 12500 },
  ];

  for (const c of sampleCards) {
    const price = calculatePrice(c.jpy, rate);

    await db.insert(cards).values({
      cardNumber: c.cardNumber,
      sku: c.sku,
      name: c.name,
      setCode: c.setCode,
      setName: c.setName,
      cardrushUrl: `https://www.cardrush-op.jp/product/${c.cardNumber}`,
      cardrushJpy: c.jpy,
      gbpJpyRate: rate,
      baseGbp: price.baseGbp,
      priceExVat: price.priceExVat,
      lastSyncedAt: new Date().toISOString(),
    }).onConflictDoNothing();
  }

  console.log("Seeded database with admin, test client, and 10 sample cards");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
