// db/schema.ts
import { pgTable, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";

export const urlsTable = pgTable("urls", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mainUrl: text("main_url").notNull(),
  subUrls: jsonb("sub_urls").notNull().default({}),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertUrl = typeof urlsTable.$inferInsert;
export type SelectUrl = typeof urlsTable.$inferSelect;