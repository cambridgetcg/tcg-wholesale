#!/usr/bin/env tsx
// CardRush Scraper — scrapes product-group pages, maps to wholesale, upserts to DB
// Usage: npx tsx tools/scrape-cardrush.ts OP01 [--dry-run] [--discover] [--set-all]

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { getSetConfig, getAllSetCodes, SET_CONFIGS } from "./lib/config";
import { fetchGbpJpyRate } from "./lib/fx-rate";
import { fetchProductGroupPages, fetchDiscoveryPage } from "./lib/cardrush-client";
import {
  parseProductGroupPage,
  parseDiscoveryPage,
  type RawProduct,
} from "./lib/cardrush-parser";
import { mapToWholesale, type WholesaleCard } from "./lib/cardrush-mapper";
import { uploadImagesToS3, s3ImageUrl } from "./lib/s3-images";

// DB imports — only used when not --dry-run
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { cards, games, sets, priceHistory } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const dryRun = flags.has("--dry-run");
const discover = flags.has("--discover");
const setAll = flags.has("--set-all");
const skipImages = flags.has("--skip-images");

// ---------------------------------------------------------------------------
// Discovery mode
// ---------------------------------------------------------------------------

async function runDiscover() {
  console.log("\n=== CardRush Product-Group Discovery ===\n");
  const html = await fetchDiscoveryPage();
  const groups = parseDiscoveryPage(html);

  if (groups.length === 0) {
    console.log("No product-group links found. The page structure may have changed.");
    return;
  }

  console.log("\nDiscovered product groups:\n");
  console.log("  ID  | Name");
  console.log("  ----|-----------------------------");
  for (const g of groups) {
    const known = Object.values(SET_CONFIGS).find(
      (s) => s.productGroupId === g.id
    );
    const tag = known ? ` ✓ (${known.code})` : "";
    console.log(`  ${String(g.id).padStart(3)} | ${g.name}${tag}`);
  }

  // Save cache
  const cachePath = join("data", "cardrush", "product-groups.json");
  mkdirSync(join("data", "cardrush"), { recursive: true });
  writeFileSync(cachePath, JSON.stringify(groups, null, 2));
  console.log(`\nSaved to ${cachePath}`);
}

// ---------------------------------------------------------------------------
// Main scrape pipeline
// ---------------------------------------------------------------------------

async function scrapeSet(setCode: string) {
  const startTime = Date.now();
  const config = getSetConfig(setCode);
  if (!config) {
    console.error(
      `Unknown set: ${setCode}. Known sets: ${getAllSetCodes().join(", ")}`
    );
    console.error("Run with --discover to find product-group IDs.");
    process.exit(1);
  }

  console.log(`\n=== Scraping ${config.code} (${config.name}) ===`);
  console.log(`  Product group: ${config.productGroupId}`);
  console.log(`  Mode: ${dryRun ? "DRY RUN (no DB)" : "FULL (with DB upsert)"}\n`);

  // Step 1: Fetch exchange rate
  console.log("[1/7] Fetching GBP/JPY rate...");
  const gbpJpyRate = await fetchGbpJpyRate();

  // Step 2: Fetch all pages
  console.log("[2/7] Fetching product pages...");
  const htmlPages = await fetchProductGroupPages(config.productGroupId);

  // Step 3: Parse HTML → raw products
  console.log("[3/7] Parsing HTML...");
  const rawProducts: RawProduct[] = [];
  for (const html of htmlPages) {
    const parsed = parseProductGroupPage(html);
    rawProducts.push(...parsed);
  }
  console.log(`  Parsed ${rawProducts.length} raw product listings`);

  // Step 4: Save raw JSON
  console.log("[4/7] Saving raw data...");
  const today = new Date().toISOString().slice(0, 10);
  const rawDir = join("data", "cardrush", "raw");
  mkdirSync(rawDir, { recursive: true });
  const rawPath = join(rawDir, `${setCode}-${today}.json`);
  writeFileSync(rawPath, JSON.stringify(rawProducts, null, 2));
  console.log(`  Saved ${rawProducts.length} products → ${rawPath}`);

  // Step 5: Map to wholesale
  console.log("[5/7] Mapping to wholesale...");
  const wholesale = mapToWholesale(rawProducts, setCode, gbpJpyRate);

  // Save wholesale JSON
  const wsDir = join("data", "cardrush", "wholesale");
  mkdirSync(wsDir, { recursive: true });
  const wsPath = join(wsDir, `${setCode}-${today}.json`);
  writeFileSync(wsPath, JSON.stringify(wholesale, null, 2));
  console.log(`  Mapped ${wholesale.length} wholesale cards → ${wsPath}`);

  // Print summary
  printSummary(rawProducts, wholesale, setCode);

  // Step 6: Upload images to S3
  if (skipImages) {
    console.log("\n[6/7] Skipping image upload (--skip-images)");
  } else {
    console.log("\n[6/7] Uploading images to S3...");
    const imgResult = await uploadImagesToS3(wholesale);
    console.log(`  Uploaded: ${imgResult.uploaded}, Skipped: ${imgResult.skipped}, Failed: ${imgResult.failed}`);

    // Set S3 URLs on wholesale cards for DB upsert
    for (const card of wholesale) {
      if (card.imageUrl) {
        card.imageUrl = s3ImageUrl(card);
      }
    }

    // Re-save wholesale JSON with S3 URLs
    writeFileSync(wsPath, JSON.stringify(wholesale, null, 2));
  }

  // Step 7: DB upsert
  if (dryRun) {
    console.log("\n[7/7] Skipping DB upsert (--dry-run)");
  } else {
    console.log("\n[7/7] Upserting to database...");
    await upsertToDb(wholesale, config.gameCode, setCode, gbpJpyRate, today);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function printSummary(
  raw: RawProduct[],
  wholesale: WholesaleCard[],
  setCode: string
) {
  console.log(`\n--- Summary for ${setCode} ---`);
  console.log(`  Total raw listings:   ${raw.length}`);
  console.log(`  Wholesale cards:      ${wholesale.length}`);

  if (wholesale.length > 0) {
    const prices = wholesale.map((w) => w.cardrushJpy);
    const minJpy = Math.min(...prices);
    const maxJpy = Math.max(...prices);
    const gbpPrices = wholesale.map((w) => w.pricing.priceExVat);
    const minGbp = Math.min(...gbpPrices).toFixed(2);
    const maxGbp = Math.max(...gbpPrices).toFixed(2);
    const parallels = wholesale.filter((w) => w.isParallel).length;
    const standards = wholesale.length - parallels;

    console.log(`  Price range (JPY):    ¥${minJpy.toLocaleString()} – ¥${maxJpy.toLocaleString()}`);
    console.log(`  Price range (GBP):    £${minGbp} – £${maxGbp}`);
    console.log(`  Standard cards:       ${standards}`);
    console.log(`  Parallel cards:       ${parallels}`);
  }

  // Estimate for multi-set runs
  const totalSets = Object.keys(SET_CONFIGS).length;
  if (totalSets > 1) {
    const estMinutes = ((totalSets * 6 * 1.5) / 60).toFixed(1);
    console.log(`  Est. all ${totalSets} sets:     ~${estMinutes} min`);
  }
}

// ---------------------------------------------------------------------------
// Database upsert
// ---------------------------------------------------------------------------

async function upsertToDb(
  wholesale: WholesaleCard[],
  gameCode: string,
  setCode: string,
  gbpJpyRate: number,
  today: string
) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is required for DB upsert. Use --dry-run to skip.");
    process.exit(1);
  }

  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    // Get-or-create game
    let [game] = await db
      .select()
      .from(games)
      .where(eq(games.code, gameCode))
      .limit(1);
    if (!game) {
      await db.insert(games).values({
        code: gameCode,
        name: "One Piece",
        slug: "one-piece",
        active: true,
        sortOrder: 0,
      });
      [game] = await db
        .select()
        .from(games)
        .where(eq(games.code, gameCode))
        .limit(1);
    }

    // Get-or-create set
    let [set] = await db
      .select()
      .from(sets)
      .where(eq(sets.code, setCode))
      .limit(1);
    if (!set) {
      const config = getSetConfig(setCode)!;
      await db.insert(sets).values({
        gameId: game!.id,
        code: setCode,
        name: config.name,
        sortOrder: 0,
      });
      [set] = await db
        .select()
        .from(sets)
        .where(eq(sets.code, setCode))
        .limit(1);
    }

    const now = new Date();
    let upserted = 0;

    for (const card of wholesale) {
      // Upsert card by SKU
      await db
        .insert(cards)
        .values({
          cardNumber: card.cardNumber,
          sku: card.sku,
          name: card.name,
          setCode,
          setName: set!.name,
          cardrushUrl: card.cardrushUrl,
          cardrushJpy: card.cardrushJpy,
          gbpJpyRate,
          baseGbp: card.pricing.baseGbp,
          priceExVat: card.pricing.priceExVat,
          lastSyncedAt: now,
          gameId: game!.id,
          setId: set!.id,
          category: "singles" as const,
          imageUrl: card.imageUrl,
        })
        .onConflictDoUpdate({
          target: cards.sku,
          set: {
            name: card.name,
            cardrushUrl: card.cardrushUrl,
            cardrushJpy: card.cardrushJpy,
            gbpJpyRate,
            baseGbp: card.pricing.baseGbp,
            priceExVat: card.pricing.priceExVat,
            lastSyncedAt: now,
            gameId: game!.id,
            setId: set!.id,
            imageUrl: card.imageUrl,
          },
        });

      // Upsert price history
      const [dbCard] = await db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.sku, card.sku))
        .limit(1);

      if (dbCard) {
        await db
          .insert(priceHistory)
          .values({
            cardId: dbCard.id,
            date: today,
            cardrushJpy: card.cardrushJpy,
            gbpJpyRate,
          })
          .onConflictDoUpdate({
            target: [priceHistory.cardId, priceHistory.date],
            set: {
              cardrushJpy: card.cardrushJpy,
              gbpJpyRate,
            },
          });
      }

      upserted++;
    }

    // Verification: count cards for this set
    const allSetCards = await db
      .select({ id: cards.id })
      .from(cards)
      .where(eq(cards.setCode, setCode));
    console.log(`  Upserted ${upserted} cards`);
    console.log(`  Total ${setCode} cards in DB: ${allSetCards.length}`);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  if (discover) {
    await runDiscover();
    return;
  }

  if (setAll) {
    const codes = getAllSetCodes();
    console.log(`\n=== Scraping all ${codes.length} sets ===\n`);
    const totalStart = Date.now();
    for (let i = 0; i < codes.length; i++) {
      console.log(`\n[${ i + 1}/${codes.length}]`);
      await scrapeSet(codes[i]);
    }
    const totalElapsed = ((Date.now() - totalStart) / 1000 / 60).toFixed(1);
    console.log(`\n=== All ${codes.length} sets complete in ${totalElapsed} min ===`);
    return;
  }

  const setCode = positional[0]?.toUpperCase();
  if (!setCode) {
    console.error("Usage: npx tsx tools/scrape-cardrush.ts <SET_CODE> [--dry-run] [--skip-images]");
    console.error("       npx tsx tools/scrape-cardrush.ts --discover");
    console.error(`\nKnown sets: ${getAllSetCodes().join(", ")}`);
    process.exit(1);
  }

  await scrapeSet(setCode);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
