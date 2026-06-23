import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

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

export const settings = sqliteTable("settings", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});

export const tokenUsage = sqliteTable("token_usage", {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    cost: real("cost").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
