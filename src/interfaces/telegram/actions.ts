import { type Telegraf, type Context } from "telegraf";
import { loadSession, createSession } from "../../session/session-manager.js";
import { setSetting } from "../../utils/settings-service.js";
import * as Diff from "diff";
import { state, config } from "./state.js";

interface ActionContext extends Context {
    match: RegExpExecArray;
}

export function registerActions(bot: Telegraf<Context>) {
    bot.action(/^load_session_(.+)$/, async (ctx) => {
        const actionCtx = ctx as ActionContext;
        const sessionId = actionCtx.match[1]!;
        const loaded = loadSession(config.codebasePath, sessionId);
        if (loaded) {
            state.session = loaded;
            await ctx.reply(`Restored session: <b>${state.session.title}</b>`, {
                parse_mode: "HTML",
            });
        } else {
            await ctx.reply("Failed to load session.");
        }
        await ctx.answerCbQuery();
    });

    bot.action("new_session", async (ctx) => {
        state.session = createSession(config.codebasePath);
        await ctx.reply(`Created new session: <b>${state.session.title}</b>`, {
            parse_mode: "HTML",
        });
        await ctx.answerCbQuery();
    });

    bot.action("mode_agent", async (ctx) => {
        state.isPlanMode = false;
        await ctx.reply("Operational mode switched to: <b>AGENT MODE</b>", { parse_mode: "HTML" });
        await ctx.answerCbQuery();
    });

    bot.action("mode_plan", async (ctx) => {
        state.isPlanMode = true;
        state.isExecutingPlan = false;
        await ctx.reply("Operational mode switched to: <b>PLAN MODE</b>", { parse_mode: "HTML" });
        await ctx.answerCbQuery();
    });

    bot.action(/^style_(.+)$/, async (ctx) => {
        const actionCtx = ctx as ActionContext;
        const targetStyle = actionCtx.match[1]!;
        await setSetting("writing_style", targetStyle);
        await ctx.reply(`Agent writing style set to: <b>${targetStyle.toUpperCase()}</b>`, {
            parse_mode: "HTML",
        });
        await ctx.answerCbQuery();
    });

    bot.action(/^diff_(.+)$/, async (ctx) => {
        const actionCtx = ctx as ActionContext;
        const actionId = actionCtx.match[1]!;
        await ctx.answerCbQuery("Generating diff...");

        if (!state.activeApprovals) {
            await ctx.reply("No active actions to review.");
            return;
        }

        const action = state.activeApprovals.tracker.getActions().find((a) => a.id === actionId);
        if (!action) {
            await ctx.reply("Action not found.");
            return;
        }

        const before = action.details.before || "";
        const after = action.details.after || "";
        const patch = Diff.createPatch(action.path, before, after);

        let formattedPatch = `<b>Diff for <code>${action.path}</code>:</b>\n\n<pre><code>${patch}</code></pre>`;
        if (formattedPatch.length > 4000) {
            formattedPatch =
                formattedPatch.slice(0, 3900) +
                "\n... (truncated due to Telegram message length limits)</code></pre>";
        }

        await ctx.reply(formattedPatch, { parse_mode: "HTML" }).catch(async () => {
            await ctx.reply(`Diff for ${action.path}:\n\n${patch.slice(0, 3800)}`);
        });
    });

    bot.action(/^approve_(.+)$/, async (ctx) => {
        const actionCtx = ctx as ActionContext;
        const actionId = actionCtx.match[1]!;
        await ctx.answerCbQuery("Approving...");
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});

        if (!state.activeApprovals) {
            await ctx.reply("No active actions found to approve.");
            return;
        }

        const action = state.activeApprovals.tracker
            .getPendingMutations()
            .find((a) => a.id === actionId);
        if (!action) {
            await ctx.reply("Action already approved, rejected, or missing.");
            return;
        }

        state.activeApprovals.tracker.updateStatus(actionId, "approved", true);

        const { errors } = state.activeApprovals.approvalExecutor.applyApprovedFromTracker();
        if (errors.length) {
            await ctx.reply(`<b>Execution Failure:</b> ${errors[0]}`, { parse_mode: "HTML" });
        } else {
            await ctx.reply(`Approved and applied action for: <code>${action.path}</code>`, {
                parse_mode: "HTML",
            });
        }

        const remaining = state.activeApprovals.tracker.getPendingMutations();
        if (remaining.length === 0) {
            state.activeApprovals = null;
        }
    });

    bot.action(/^reject_(.+)$/, async (ctx) => {
        const actionCtx = ctx as ActionContext;
        const actionId = actionCtx.match[1]!;
        await ctx.answerCbQuery("Rejecting...");
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});

        if (!state.activeApprovals) {
            await ctx.reply("No active actions found to reject.");
            return;
        }

        const action = state.activeApprovals.tracker
            .getPendingMutations()
            .find((a) => a.id === actionId);
        if (!action) {
            await ctx.reply("Action already approved, rejected, or missing.");
            return;
        }

        state.activeApprovals.tracker.updateStatus(actionId, "rejected", false);
        await ctx.reply(`Rejected action for: <code>${action.path}</code>`, { parse_mode: "HTML" });

        const remaining = state.activeApprovals.tracker.getPendingMutations();
        if (remaining.length === 0) {
            state.activeApprovals = null;
        }
    });

    bot.action("approve_all_actions", async (ctx) => {
        await ctx.answerCbQuery("Applying all changes...");
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});

        if (!state.activeApprovals) {
            await ctx.reply("No active actions found to approve.");
            return;
        }

        const pending = state.activeApprovals.tracker.getPendingMutations();
        pending.forEach((a) => {
            state.activeApprovals!.tracker.updateStatus(a.id, "approved", true);
        });

        const { errors } = state.activeApprovals.approvalExecutor.applyApprovedFromTracker();
        if (errors.length) {
            await ctx.reply(
                `<b>Execution Failures:</b>\n${errors.map((e) => `• ${e}`).join("\n")}`,
                { parse_mode: "HTML" }
            );
        } else {
            await ctx.reply("All staged mutations applied successfully.");
        }

        state.activeApprovals = null;
    });

    bot.action("reject_all_actions", async (ctx) => {
        await ctx.answerCbQuery("Rejecting all changes...");
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});

        if (state.activeApprovals) {
            const pending = state.activeApprovals.tracker.getPendingMutations();
            pending.forEach((a) => {
                state.activeApprovals!.tracker.updateStatus(a.id, "rejected", false);
            });
            state.activeApprovals.tracker.clear();
            state.activeApprovals = null;
        }
        await ctx.reply("All staged changes rejected.");
    });
}
