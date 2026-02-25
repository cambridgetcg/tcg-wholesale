import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { mkdirSync } from "fs";
import { hashSync } from "bcryptjs";
import { clients, cards, games, sets } from "./schema";
import { eq } from "drizzle-orm";
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
      last_synced_at TEXT,
      game_id INTEGER REFERENCES games(id),
      set_id INTEGER REFERENCES sets(id),
      category TEXT NOT NULL DEFAULT 'singles',
      product_type TEXT,
      image_url TEXT
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
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      image_url TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      release_date TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );
    CREATE UNIQUE INDEX IF NOT EXISTS sets_game_code_idx ON sets(game_id, code);
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
    volumeDiscountPct: 0.04,
  }).onConflictDoNothing();

  // Seed games
  const gameData = [
    { code: "onepiece", name: "One Piece", slug: "one-piece", sortOrder: 0, active: true },
    { code: "pokemon", name: "Pokémon", slug: "pokemon", sortOrder: 1, active: false },
    { code: "yugioh", name: "Yu-Gi-Oh!", slug: "yu-gi-oh", sortOrder: 2, active: false },
    { code: "dragonball", name: "Dragon Ball", slug: "dragon-ball", sortOrder: 3, active: false },
  ];

  for (const g of gameData) {
    await db.insert(games).values(g).onConflictDoNothing();
  }

  // Seed One Piece sets
  const onepieceGame = await db.select({ id: games.id }).from(games).where(eq(games.code, "onepiece")).get();
  const onepieceId = onepieceGame!.id;

  const setData = [
    { code: "OP01", name: "Romance Dawn", releaseDate: "2022-07-22", sortOrder: 0 },
    { code: "OP02", name: "Paramount War", releaseDate: "2022-11-04", sortOrder: 1 },
    { code: "OP03", name: "Pillars of Strength", releaseDate: "2023-01-27", sortOrder: 2 },
    { code: "OP04", name: "Kingdoms of Intrigue", releaseDate: "2023-05-27", sortOrder: 3 },
    { code: "OP05", name: "Awakening of the New Era", releaseDate: "2023-08-25", sortOrder: 4 },
    { code: "OP06", name: "Wings of the Captain", releaseDate: "2023-11-25", sortOrder: 5 },
    { code: "OP07", name: "500 Years in the Future", releaseDate: "2024-02-24", sortOrder: 6 },
    { code: "OP08", name: "Two Legends", releaseDate: "2024-05-25", sortOrder: 7 },
    { code: "OP09", name: "The Four Emperors", releaseDate: "2024-08-24", sortOrder: 8 },
    { code: "OP10", name: "Royal Blood", releaseDate: "2024-11-23", sortOrder: 9 },
    { code: "ST01", name: "Starter Deck: Straw Hat Crew", sortOrder: 100 },
    { code: "ST02", name: "Starter Deck: Worst Generation", sortOrder: 101 },
    { code: "ST03", name: "Starter Deck: The Seven Warlords", sortOrder: 102 },
    { code: "ST04", name: "Starter Deck: Animal Kingdom Pirates", sortOrder: 103 },
    { code: "ST05", name: "Starter Deck: Film Edition", sortOrder: 104 },
    { code: "ST06", name: "Starter Deck: Navy", sortOrder: 105 },
    { code: "ST07", name: "Starter Deck: Big Mom Pirates", sortOrder: 106 },
    { code: "ST08", name: "Starter Deck: Monkey D. Luffy", sortOrder: 107 },
    { code: "ST09", name: "Starter Deck: Yamato", sortOrder: 108 },
    { code: "ST10", name: "Starter Deck: Ultimate Deck", sortOrder: 109 },
    { code: "ST11", name: "Starter Deck: Uta", sortOrder: 110 },
    { code: "ST12", name: "Starter Deck: Zoro & Sanji", sortOrder: 111 },
    { code: "ST13", name: "Starter Deck: The Three Captains", sortOrder: 112 },
    { code: "ST14", name: "Starter Deck: 3D2Y", sortOrder: 113 },
    { code: "ST15", name: "Starter Deck: RED Edward Newgate", sortOrder: 114 },
    { code: "ST16", name: "Starter Deck: GREEN Uta", sortOrder: 115 },
    { code: "EB01", name: "Memorial Collection", releaseDate: "2024-01-27", sortOrder: 50 },
    { code: "PRB01", name: "Premium Booster", releaseDate: "2023-10-28", sortOrder: 51 },
  ];

  for (const s of setData) {
    await db.insert(sets).values({ ...s, gameId: onepieceId }).onConflictDoNothing();
  }

  // Build set ID lookup map
  const allSets = await db.select({ id: sets.id, code: sets.code }).from(sets).where(eq(sets.gameId, onepieceId));
  const setIdMap = Object.fromEntries(allSets.map(s => [s.code, s.id]));

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
      gameId: onepieceId,
      setId: setIdMap[c.setCode],
      category: "singles" as const,
    }).onConflictDoNothing();
  }

  console.log("Seeded database with admin, test client, and 10 sample cards");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
