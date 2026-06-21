import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const memories = sqliteTable("memories", {
    id: text("id").primaryKey(),
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
