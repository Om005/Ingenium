import { eq } from "drizzle-orm";
import { getDb } from "@db/client.js";
import { settings } from "@db/schema.js";

export type WritingStyle = "default" | "formal" | "descriptive" | "concise";

export async function getSetting(key: string, defaultValue: string): Promise<string> {
    try {
        const db = getDb();
        const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
        if (result.length > 0) {
            return result[0]!.value;
        }
    } catch {
        // suppress error
    }
    return defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
    const db = getDb();
    const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);

    if (existing.length > 0) {
        await db.update(settings).set({ value }).where(eq(settings.key, key));
    } else {
        await db.insert(settings).values({ key, value });
    }
}

export async function getAgentSystemPromptModifier(): Promise<string> {
    const style = (await getSetting("writing_style", "default")) as WritingStyle;
    const customInstructions = await getSetting("custom_instructions", "");

    let modifier = "";

    switch (style) {
        case "concise":
            modifier +=
                "\n\n[Persona Style: CONCISE]\n- Keep your responses extremely short, focused, and directly code-centric.\n- Avoid writing unnecessary explanations, pleasantries, or introductory/concluding filler text.\n- Prioritize showing code blocks directly.";
            break;
        case "descriptive":
            modifier +=
                "\n\n[Persona Style: DESCRIPTIVE]\n- Provide thorough, detailed, step-by-step explanations for your code.\n- Break down complex logic and explain the design choices you make.\n- Structure your response like an informative guide or tutorial.";
            break;
        case "formal":
            modifier +=
                "\n\n[Persona Style: FORMAL]\n- Maintain a highly professional, academic, and formal tone in all communications.\n- Use rigorous software engineering terminology.\n- Avoid casual phrasing or colloquialisms.";
            break;
        default:
            // Default uses standard agent prompt guidelines
            break;
    }

    if (customInstructions.trim()) {
        modifier += `\n\n[Custom Guidelines (Strictly Follow)]\n${customInstructions}`;
    }

    return modifier;
}
