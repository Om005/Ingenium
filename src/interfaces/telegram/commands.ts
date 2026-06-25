import { type Telegraf, Markup, type Context } from "telegraf";
import fs from "node:fs";
import path from "node:path";
import { listSessions, appendMessage } from "../../session/session-manager.js";
import { getSetting, setSetting } from "../../utils/settings-service.js";
import { getSessionUsageSummary, getGlobalUsageSummary } from "../../utils/token-logger.js";
import { state, config } from "./state.js";
import { runAgentExecutionLoop } from "./agent-loop.js";

export function registerCommands(bot: Telegraf<Context>) {
    // Start / Welcome Command
    bot.start(async (ctx) => {
        const currentMode = state.isPlanMode ? "Plan Mode" : "Agent Mode";
        const msg = `<b>Welcome to Ingenium!</b>\n\nI am your local developer AI assistant.\n\n• <b>Current operational mode:</b> <code>${currentMode}</code>\n• <b>Current session ID:</b> <code>${state.session.id}</code>\n\nRun /help to view available commands.`;
        await ctx.reply(msg, { parse_mode: "HTML" });
    });

    // Help Command
    bot.help(async (ctx) => {
        const helpText = `
<b>Ingenium Bot Commands:</b>
/start - Welcome message
/sessions - List or switch active sessions
/clear - Wipe current session memory
/mode - Toggle between Agent and Plan modes
/style - Change agent persona/writing style
/instructions - View or update custom guidelines
/clear_instructions - Reset custom guidelines
/analytics - Display token usage metrics
/temporary - Toggle ephemeral mode (don't save logs)
/execute - (Plan Mode) Run the ingenium-plan.md plan
/help - Display this command list
        `.trim();
        await ctx.reply(helpText, { parse_mode: "HTML" });
    });

    // Sessions Command
    bot.command("sessions", async (ctx) => {
        const sessionsList = listSessions(config.codebasePath);
        const buttons = sessionsList
            .slice(0, 8)
            .map((s) => [
                Markup.button.callback(`${s.title.slice(0, 30)}...`, `load_session_${s.id}`),
            ]);
        buttons.push([Markup.button.callback("Create New Session", "new_session")]);

        await ctx.reply("<b>Select operational session:</b>", {
            parse_mode: "HTML",
            ...Markup.inlineKeyboard(buttons),
        });
    });

    // Clear Command
    bot.command("clear", async (ctx) => {
        state.session.messages = [];
        await ctx.reply("Session context wiped. Memory is clear.");
    });

    // Mode Command (Agent/Plan)
    bot.command("mode", async (ctx) => {
        const currentMode = state.isPlanMode ? "Plan Mode" : "Agent Mode";
        await ctx.reply(
            `<b>Current Operational Mode:</b> <code>${currentMode.toUpperCase()}</code>\n\nSelect a mode to switch:`,
            {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback("Agent Mode", "mode_agent"),
                        Markup.button.callback("Plan Mode", "mode_plan"),
                    ],
                ]),
            }
        );
    });

    // Style Command
    bot.command("style", async (ctx) => {
        const currentStyle = await getSetting("writing_style", "default");
        await ctx.reply(
            `<b>Current Writing Style:</b> <code>${currentStyle.toUpperCase()}</code>\n\nChoose a style:`,
            {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback("Default", "style_default"),
                        Markup.button.callback("Concise", "style_concise"),
                    ],
                    [
                        Markup.button.callback("Descriptive", "style_descriptive"),
                        Markup.button.callback("Formal", "style_formal"),
                    ],
                ]),
            }
        );
    });

    // Custom Instructions Command
    bot.command("instructions", async (ctx) => {
        const message = ctx.message as { text?: string };
        const instText = (message.text || "").slice("/instructions".length).trim();
        if (!instText) {
            const current = await getSetting("custom_instructions", "");
            await ctx.reply(
                `<b>Current Custom Instructions:</b>\n\n${current || "<i>None</i>"}\n\nTo update, run: <code>/instructions [your rules here]</code>`,
                { parse_mode: "HTML" }
            );
        } else {
            await setSetting("custom_instructions", instText);
            await ctx.reply("Custom instructions updated successfully.");
        }
    });

    // Clear Instructions Command
    bot.command("clear_instructions", async (ctx) => {
        await setSetting("custom_instructions", "");
        await ctx.reply("Custom instructions cleared.");
    });

    // Analytics / Usage Command
    bot.command("analytics", async (ctx) => {
        const sessionSummary = await getSessionUsageSummary(state.session.id);
        const globalSummary = await getGlobalUsageSummary();
        const formatNum = (n: number) => n.toLocaleString();

        const report = `
<b>INGENIUM TOKEN ANALYTICS</b>

<b>Current Session Usage:</b>
• Prompt Tokens: <code>${formatNum(sessionSummary.totalPrompt)}</code>
• Completion Tokens: <code>${formatNum(sessionSummary.totalCompletion)}</code>
• Total Tokens: <code>${formatNum(sessionSummary.totalTokens)}</code>

<b>Global Lifetime Usage:</b>
• Total Queries: <code>${formatNum(globalSummary.count)}</code>
• Prompt Tokens: <code>${formatNum(globalSummary.totalPrompt)}</code>
• Completion Tokens: <code>${formatNum(globalSummary.totalCompletion)}</code>
• Total Tokens: <code>${formatNum(globalSummary.totalTokens)}</code>
        `.trim();
        await ctx.reply(report, { parse_mode: "HTML" });
    });

    // Temporary Command
    bot.command("temporary", async (ctx) => {
        state.isTemporaryMode = !state.isTemporaryMode;
        if (state.isTemporaryMode) {
            await ctx.reply(
                "<b>Temporary Mode ENABLED.</b>\nLogs and message history will not be saved to disk.",
                { parse_mode: "HTML" }
            );
        } else {
            await ctx.reply(
                "<b>Temporary Mode DISABLED.</b>\nSession logs will be saved to disk.",
                { parse_mode: "HTML" }
            );
        }
    });

    // Execute Command
    bot.command("execute", async (ctx) => {
        if (!state.isPlanMode) {
            await ctx.reply(
                "Error: `/execute` is only available in Plan Mode. Use `/mode` to switch."
            );
            return;
        }
        const planPath = path.join(config.codebasePath, "ingenium-plan.md");
        if (!fs.existsSync(planPath)) {
            await ctx.reply(
                "Error: No `ingenium-plan.md` file found in the workspace root. Please generate a plan first."
            );
            return;
        }

        const planContent = fs.readFileSync(planPath, "utf8");
        await ctx.reply("<b>Executing approved plan from ingenium-plan.md...</b>", {
            parse_mode: "HTML",
        });
        state.isExecutingPlan = true;

        const msgText = `Plan Execution Request: Please read and execute the approved plan from "ingenium-plan.md" step-by-step. Here is the current content of "ingenium-plan.md":\n\n${planContent}`;

        if (state.isTemporaryMode) {
            state.session.messages.push({ role: "user", content: msgText });
        } else {
            appendMessage(state.session, { role: "user", content: msgText });
        }

        await runAgentExecutionLoop(ctx);
    });
}
