import { getDb } from "@db/client.js";
import { reminders } from "@db/schema.js";
import { eq } from "drizzle-orm";
import { exec } from "node:child_process";

class ReminderScheduler {
    private activeTimeouts = new Map<string, NodeJS.Timeout>();

    constructor() {}

    async init() {
        const db = getDb();
        const pending = await db.select().from(reminders).where(eq(reminders.fired, 0));

        const now = new Date();
        for (const reminder of pending) {
            const timeDiff = reminder.triggerAt.getTime() - now.getTime();
            if (timeDiff <= 0) {
                await this.trigger(reminder.id, reminder.message);
            } else {
                this.schedule(reminder.id, reminder.message, reminder.triggerAt);
            }
        }
    }

    schedule(id: string, text: string, triggerAt: Date) {
        const delay = triggerAt.getTime() - Date.now();
        if (delay <= 0) {
            void this.trigger(id, text);
            return;
        }

        this.cancelTimeout(id);

        const timeout = setTimeout(() => {
            void this.trigger(id, text);
        }, delay);

        this.activeTimeouts.set(id, timeout);
    }

    cancelTimeout(id: string) {
        const t = this.activeTimeouts.get(id);
        if (t) {
            clearTimeout(t);
            this.activeTimeouts.delete(id);
        }
    }

    async trigger(id: string, text: string) {
        this.activeTimeouts.delete(id);

        try {
            const db = getDb();
            await db.update(reminders).set({ fired: 1 }).where(eq(reminders.id, id));
        } catch {
            // Suppress errors
        }

        process.stdout.write("\u0007");

        this.sendDesktopNotification("Ingenium Reminder", text);
    }

    private sendDesktopNotification(title: string, message: string) {
        const escapedMessage = message.replace(/"/g, '\\"');
        const escapedTitle = title.replace(/"/g, '\\"');

        if (process.platform === "linux") {
            exec(
                `notify-send "${escapedTitle}" "${escapedMessage}" --icon=dialog-information`,
                () => {
                    // Suppress errors
                }
            );
        } else if (process.platform === "darwin") {
            exec(
                `osascript -e 'display notification "${escapedMessage}" with title "${escapedTitle}"'`,
                () => {
                    // Suppress errors
                }
            );
        } else if (process.platform === "win32") {
            const psCmd = `powershell -Command "[void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('${escapedMessage}', '${escapedTitle}')"`;
            exec(psCmd, () => {
                // Suppress errors
            });
        }
    }
}

export const reminderScheduler = new ReminderScheduler();
