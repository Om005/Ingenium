import { Telegraf, type Context } from "telegraf";
import env from "../../config/env.js";
import { appendMessage } from "../../session/session-manager.js";
import chalk from "chalk";
import { log, spinner } from "@clack/prompts";
import { state } from "./state.js";
import { runAgentExecutionLoop } from "./agent-loop.js";
import { registerCommands } from "./commands.js";
import { registerActions } from "./actions.js";

export async function runTelegramMode() {
    const bot = new Telegraf<Context>(env.TELEGRAM_BOT_TOKEN);

    // Middleware: Authorization check
    bot.use(async (ctx, next) => {
        const userId = ctx.from?.id.toString();
        if (userId !== env.TELEGRAM_USER_ID) {
            await ctx.reply("Access Denied. Unauthorized user.");
            return;
        }
        await next();
    });

    // Register commands and actions
    registerCommands(bot);
    registerActions(bot);

    // Handle normal text messages (chatting)
    bot.on("text", async (ctx) => {
        if (ctx.message.text.startsWith("/")) return;

        if (state.activeApprovals && state.activeApprovals.tracker.hasPendingActions()) {
            await ctx.reply(
                "You have staged changes pending approval. Please approve or reject them using the buttons before sending more commands."
            );
            return;
        }

        const userMessage = ctx.message.text.trim();
        if (state.isTemporaryMode) {
            state.session.messages.push({ role: "user", content: userMessage });
        } else {
            appendMessage(state.session, { role: "user", content: userMessage });
        }

        await runAgentExecutionLoop(ctx);
    });

    await bot.launch();

    console.clear();
    log.success("Ingenium Telegram Bot interface is ONLINE.");
    log.info(`Authenticated Telegram ID: ${chalk.cyan(env.TELEGRAM_USER_ID)}`);

    const botSpinner = spinner();
    botSpinner.start("Telegram Bot operational. Listening for messages...");

    // Clean shutdown on exit
    process.once("SIGINT", () => {
        botSpinner.stop("System offline. Shutting down Telegram bot...");
        bot.stop("SIGINT");
    });
    process.once("SIGTERM", () => {
        botSpinner.stop("System offline. Shutting down Telegram bot...");
        bot.stop("SIGTERM");
    });
}
