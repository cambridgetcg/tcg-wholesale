import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  real,
  timestamp,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

// Custom numeric(10,2) that auto-parses to JS number (Postgres numeric returns strings)
const money = customType<{ data: number; driverData: string }>({
  dataType() {
    return "numeric(10, 2)";
  },
  fromDriver(value: string): number {
    return Number(value);
  },
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  company: text("company"),
  role: text("role", { enum: ["admin", "client"] }).notNull().default("client"),
  currentMonthSpend: money("current_month_spend").notNull().default(0),
  priorMonthSpend: money("prior_month_spend").notNull().default(0),
  volumeDiscountPct: real("volume_discount_pct").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true),
});

export const sets = pgTable("sets", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id").notNull().references(() => games.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  releaseDate: text("release_date"),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true),
}, (table) => ({
  gameCodeUnique: uniqueIndex("sets_game_code_idx").on(table.gameId, table.code),
}));

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  cardNumber: text("card_number").notNull(),
  sku: text("sku").notNull().unique(),
  name: text("name").default(""),
  setCode: text("set_code"),
  setName: text("set_name"),
  cardrushUrl: text("cardrush_url"),
  cardrushJpy: integer("cardrush_jpy"),
  gbpJpyRate: real("gbp_jpy_rate"),
  baseGbp: money("base_gbp"),
  priceExVat: money("price_ex_vat"),
  ebayItemNumber: text("ebay_item_number"),
  lastSyncedAt: timestamp("last_synced_at"),
  gameId: integer("game_id").references(() => games.id),
  setId: integer("set_id").references(() => sets.id),
  category: text("category", { enum: ["singles", "sealed"] }).notNull().default("singles"),
  productType: text("product_type"),
  imageUrl: text("image_url"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  status: text("status", {
    enum: ["draft", "submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered", "cancelled"],
  }).notNull().default("draft"),
  totalExVat: money("total_ex_vat").notNull().default(0),
  volumeDiscount: real("volume_discount").notNull().default(0),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  quotedAt: timestamp("quoted_at"),
  quotedExpiresAt: timestamp("quoted_expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  stockCheckedAt: timestamp("stock_checked_at"),
});

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  cardId: integer("card_id").notNull().references(() => cards.id),
  quantity: integer("quantity").notNull().default(1),
  unitPriceExVat: money("unit_price_ex_vat").notNull(),
  originalUnitPrice: money("original_unit_price"),
  lineTotal: money("line_total").notNull(),
  stockStatus: text("stock_status", {
    enum: ["pending", "in_stock", "out_of_stock", "price_changed"],
  }).notNull().default("pending"),
  checkedPriceJpy: integer("checked_price_jpy"),
});

export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id),
  date: text("date").notNull(),
  cardrushJpy: integer("cardrush_jpy").notNull(),
  gbpJpyRate: real("gbp_jpy_rate").notNull(),
}, (table) => ({
  cardDateUnique: uniqueIndex("price_history_card_date_idx").on(table.cardId, table.date),
}));

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  type: text("type", {
    enum: ["quote_ready", "confirmed", "shipped", "delivered", "new_order"],
  }).notNull(),
  recipient: text("recipient").notNull(),
  status: text("status", { enum: ["sent", "failed"] }).notNull(),
  error: text("error"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type Game = typeof games.$inferSelect;
export type GameSet = typeof sets.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
