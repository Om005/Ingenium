import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const memories = sqliteTable("memories", {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const reminders = sqliteTable("reminders", {
    id: text("id").primaryKey(),
    message: text("message").notNull(),
    triggerAt: integer("trigger_at", { mode: "timestamp" }).notNull(),
    fired: integer("fired").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    deliverVia: text("deliver_via").notNull().default("desktop"),
});
