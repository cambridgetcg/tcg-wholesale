import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const clients = sqliteTable("clients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  company: text("company"),
  role: text("role", { enum: ["admin", "client"] }).notNull().default("client"),
  currentMonthSpend: real("current_month_spend").notNull().default(0),
  priorMonthSpend: real("prior_month_spend").notNull().default(0),
  volumeDiscountPct: real("volume_discount_pct").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
});

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardNumber: text("card_number").notNull(),
  sku: text("sku").notNull().unique(),
  name: text("name").default(""),
  setCode: text("set_code"),
  setName: text("set_name"),
  cardrushUrl: text("cardrush_url"),
  cardrushJpy: integer("cardrush_jpy"),
  gbpJpyRate: real("gbp_jpy_rate"),
  baseGbp: real("base_gbp"),
  priceExVat: real("price_ex_vat"),
  ebayItemNumber: text("ebay_item_number"),
  lastSyncedAt: text("last_synced_at"),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: integer("client_id").notNull().references(() => clients.id),
  status: text("status", {
    enum: ["draft", "submitted", "quoted", "confirmed", "paid", "ordered", "shipped", "delivered", "cancelled"],
  }).notNull().default("draft"),
  totalExVat: real("total_ex_vat").notNull().default(0),
  volumeDiscount: real("volume_discount").notNull().default(0),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  quotedAt: text("quoted_at"),
  quotedExpiresAt: text("quoted_expires_at"),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  stockCheckedAt: text("stock_checked_at"),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id),
  cardId: integer("card_id").notNull().references(() => cards.id),
  quantity: integer("quantity").notNull().default(1),
  unitPriceExVat: real("unit_price_ex_vat").notNull(),
  originalUnitPrice: real("original_unit_price"),
  lineTotal: real("line_total").notNull(),
  stockStatus: text("stock_status", {
    enum: ["pending", "in_stock", "out_of_stock", "price_changed"],
  }).notNull().default("pending"),
  checkedPriceJpy: integer("checked_price_jpy"),
});

export const priceHistory = sqliteTable("price_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").notNull().references(() => cards.id),
  date: text("date").notNull(),
  cardrushJpy: integer("cardrush_jpy").notNull(),
  gbpJpyRate: real("gbp_jpy_rate").notNull(),
}, (table) => ({
  cardDateUnique: uniqueIndex("price_history_card_date_idx").on(table.cardId, table.date),
}));

export type Client = typeof clients.$inferSelect;
export type Card = typeof cards.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type PriceHistory = typeof priceHistory.$inferSelect;
