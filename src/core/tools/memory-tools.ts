import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "@db/client.js";
import { memories } from "@db/schema.js";

export class MemoryTools {
    constructor() {}

    async remember(key: string, value: string): Promise<string> {
        const db = getDb();
        const now = new Date();

        const existing = await db.select().from(memories).where(eq(memories.key, key)).limit(1);

        if (existing.length > 0) {
            await db.update(memories).set({ value, updatedAt: now }).where(eq(memories.key, key));
            return `Updated memory "${key}".`;
        }

        await db.insert(memories).values({
            id: randomUUID(),
            key,
            value,
            createdAt: now,
            updatedAt: now,
        });

        return `Remembered "${key}".`;
    }

    async recall(key: string): Promise<string> {
        const db = getDb();
        const result = await db.select().from(memories).where(eq(memories.key, key)).limit(1);

        if (result.length === 0) {
            return `No memory found for key "${key}".`;
        }

        return result[0]!.value;
    }

    async forget(key: string): Promise<string> {
        const db = getDb();

        const exact = await db.delete(memories).where(eq(memories.key, key));
        if (exact.changes > 0) return `Forgot "${key}".`;

        const all = await db.select().from(memories);
        const partial = all.filter((m) => m.key.toLowerCase().includes(key.toLowerCase()));

        if (partial.length === 1) {
            await db.delete(memories).where(eq(memories.key, partial[0]!.key));
            return `Forgot "${partial[0]!.key}" (matched from "${key}").`;
        }

        if (partial.length > 1) {
            return `No exact match for "${key}". Multiple similar keys exist: ${partial
                .map((m) => m.key)
                .join(", ")}. Call forget again with the exact key.`;
        }

        return `No memory found for key "${key}".`;
    }

    async listMemories(): Promise<string> {
        const db = getDb();
        const all = await db.select().from(memories).orderBy(memories.updatedAt);

        if (all.length === 0) return "(no memories saved)";

        return all
            .map((m) => {
                const preview = m.value.length > 60 ? m.value.slice(0, 60) + "..." : m.value;
                return `${m.key}: ${preview}`;
            })
            .join("\n");
    }
}
