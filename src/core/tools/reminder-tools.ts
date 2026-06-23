import { randomUUID } from "node:crypto";
import { getDb } from "@db/client.js";
import { reminders } from "@db/schema.js";
import { eq, and } from "drizzle-orm";
import { reminderScheduler } from "../executors/reminder-scheduler.js";

export class ReminderTools {
    constructor() {}

    async setReminder(text: string, delaySeconds?: number, timeString?: string): Promise<string> {
        const db = getDb();
        const now = new Date();
        let triggerAt: Date;

        if (delaySeconds !== undefined) {
            triggerAt = new Date(now.getTime() + delaySeconds * 1000);
        } else if (timeString !== undefined) {
            triggerAt = parseTimeString(timeString, now);
        } else {
            throw new Error("Either delaySeconds or timeString must be provided.");
        }

        const id = randomUUID();

        await db.insert(reminders).values({
            id,
            message: text,
            triggerAt,
            fired: 0,
            createdAt: now,
            deliverVia: "desktop",
        });

        reminderScheduler.schedule(id, text, triggerAt);

        const diffSeconds = Math.max(0, Math.round((triggerAt.getTime() - now.getTime()) / 1000));
        return `Successfully set reminder: "${text}" at ${triggerAt.toLocaleTimeString()} (in ${diffSeconds} seconds).`;
    }

    async listReminders(): Promise<string> {
        const db = getDb();
        const all = await db.select().from(reminders).orderBy(reminders.triggerAt);

        if (all.length === 0) {
            return "No reminders scheduled.";
        }

        const pending = all.filter((r) => r.fired === 0);
        const triggered = all.filter((r) => r.fired === 1);

        let output = "";
        if (pending.length > 0) {
            output +=
                "Pending Reminders:\n" +
                pending
                    .map((r) => {
                        const secondsLeft = Math.max(
                            0,
                            Math.round((r.triggerAt.getTime() - Date.now()) / 1000)
                        );
                        return `- [ID: ${r.id}] "${r.message}" (Triggers in ${secondsLeft}s at ${r.triggerAt.toLocaleTimeString()})`;
                    })
                    .join("\n");
        } else {
            output += "No pending reminders.";
        }

        if (triggered.length > 0) {
            output +=
                "\n\nPast Reminders (Recently Triggered):\n" +
                triggered
                    .slice(-5)
                    .map((r) => {
                        return `- "${r.message}" (Triggered at ${r.triggerAt.toLocaleTimeString()})`;
                    })
                    .join("\n");
        }

        return output;
    }

    async cancelReminder(id: string): Promise<string> {
        const db = getDb();

        const existing = await db
            .select()
            .from(reminders)
            .where(and(eq(reminders.id, id), eq(reminders.fired, 0)))
            .limit(1);

        if (existing.length === 0) {
            return `No pending reminder found with ID "${id}".`;
        }

        await db.delete(reminders).where(eq(reminders.id, id));

        reminderScheduler.cancelTimeout(id);

        return `Canceled reminder "${existing[0]!.message}" (ID: ${id}).`;
    }
}

function parseTimeString(timeStr: string, now: Date): Date {
    const timeClean = timeStr.trim().toLowerCase();

    const timeMatch = timeClean.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
    if (timeMatch) {
        let hours = parseInt(timeMatch[1]!, 10);
        const minutes = parseInt(timeMatch[2]!, 10);
        const ampm = timeMatch[3];

        if (ampm === "pm" && hours < 12) {
            hours += 12;
        } else if (ampm === "am" && hours === 12) {
            hours = 0;
        }

        const trigger = new Date(now);
        trigger.setHours(hours, minutes, 0, 0);

        if (timeClean.includes("tomorrow")) {
            trigger.setDate(trigger.getDate() + 1);
        } else if (trigger.getTime() <= now.getTime()) {
            trigger.setDate(trigger.getDate() + 1);
        }
        return trigger;
    }

    const parsed = new Date(timeStr);
    if (!isNaN(parsed.getTime())) {
        if (parsed.getTime() <= now.getTime()) {
            parsed.setDate(parsed.getDate() + 1);
        }
        return parsed;
    }

    throw new Error(
        `Could not parse time string "${timeStr}". Please use a format like "11:22 AM" or "17:30".`
    );
}
