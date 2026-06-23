import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@db/client.js";
import { tokenUsage } from "@db/schema.js";

const PRICE_PER_INPUT_TOKEN = 0.0015 / 1000;
const PRICE_PER_OUTPUT_TOKEN = 0.0045 / 1000;

export interface TokenSummary {
    totalPrompt: number;
    totalCompletion: number;
    totalTokens: number;
    totalCost: number;
}

export async function logTokenUsage(
    sessionId: string,
    promptTokens: number,
    completionTokens: number
): Promise<number> {
    const db = getDb();
    const cost = promptTokens * PRICE_PER_INPUT_TOKEN + completionTokens * PRICE_PER_OUTPUT_TOKEN;
    const now = new Date();

    await db.insert(tokenUsage).values({
        id: randomUUID(),
        sessionId,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        cost,
        createdAt: now,
    });

    return cost;
}

export async function getSessionUsageSummary(sessionId: string): Promise<TokenSummary> {
    const db = getDb();
    const result = await db
        .select({
            prompt: sql<number>`SUM(prompt_tokens)`,
            completion: sql<number>`SUM(completion_tokens)`,
            total: sql<number>`SUM(total_tokens)`,
            cost: sql<number>`SUM(cost)`,
        })
        .from(tokenUsage)
        .where(eq(tokenUsage.sessionId, sessionId));

    if (result.length === 0 || result[0]!.total === null) {
        return { totalPrompt: 0, totalCompletion: 0, totalTokens: 0, totalCost: 0 };
    }

    const row = result[0]!;
    return {
        totalPrompt: Number(row.prompt),
        totalCompletion: Number(row.completion),
        totalTokens: Number(row.total),
        totalCost: Number(row.cost),
    };
}

export async function getGlobalUsageSummary(): Promise<TokenSummary & { count: number }> {
    const db = getDb();
    const result = await db
        .select({
            prompt: sql<number>`SUM(prompt_tokens)`,
            completion: sql<number>`SUM(completion_tokens)`,
            total: sql<number>`SUM(total_tokens)`,
            cost: sql<number>`SUM(cost)`,
            count: sql<number>`COUNT(*)`,
        })
        .from(tokenUsage);

    if (result.length === 0 || result[0]!.total === null) {
        return { totalPrompt: 0, totalCompletion: 0, totalTokens: 0, totalCost: 0, count: 0 };
    }

    const row = result[0]!;
    return {
        totalPrompt: Number(row.prompt),
        totalCompletion: Number(row.completion),
        totalTokens: Number(row.total),
        totalCost: Number(row.cost),
        count: Number(row.count),
    };
}
