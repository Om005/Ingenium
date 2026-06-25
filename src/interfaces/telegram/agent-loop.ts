import { type Context, Markup } from "telegraf";
import { ActionTracker } from "../../core/action/action-tracker.js";
import { ApprovalExecutor } from "../../core/executors/approval-executor.js";
import { ToolExecutor } from "../../core/executors/tool-executor.js";
import { createAgentTools } from "../../core/agent/tools.js";
import { stepCountIs, ToolLoopAgent } from "ai";
import getAgentModel from "../../providers/openrouter.js";
import { appendMessage } from "../../session/session-manager.js";
import { getAgentSystemPromptModifier } from "../../utils/settings-service.js";
import { logTokenUsage } from "../../utils/token-logger.js";
import { state, config } from "./state.js";

export function extractTarget(input: unknown): string {
    if (!input || typeof input !== "object") return "";
    const obj = input as Record<string, unknown>;

    const value =
        obj.command ?? obj.query ?? obj.message ?? obj.url ?? obj.branch ?? obj.id ?? obj.path;

    if (value === undefined || value === null) return "";

    const str = String(value);
    return str.length > 70 ? str.slice(0, 70) + "..." : str;
}

export async function runAgentExecutionLoop(ctx: Context) {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const tracker = new ActionTracker();
    const approvalExecutor = new ApprovalExecutor(config, tracker);
    const executor = new ToolExecutor(config, tracker);
    const tools = createAgentTools(executor);

    const statusMsg = await ctx.reply("<b>Thinking...</b>", { parse_mode: "HTML" });
    const executedTools: string[] = [];

    try {
        const promptModifier = await getAgentSystemPromptModifier();

        let instructions = "";
        if (state.isPlanMode) {
            instructions = state.isExecutingPlan
                ? `
You are Ingenium, an expert AI coding assistant.
Workspace root: ${config.codebasePath}
Current local time is: ${new Date().toString()} (ISO: ${new Date().toISOString()}).
${promptModifier}

Rules:
- You are in EXECUTION MODE. You must execute the approved plan from "ingenium-plan.md" step-by-step using your tools (file creation, modification, shell commands, etc.).
- All file mutations are STAGED and staged changes are shown to the user for approval. Never claim a file was written; state it was staged.
- Be highly analytical and concise.
- Format responses strictly in Markdown.
                `.trim()
                : `
You are Ingenium, an expert AI coding assistant.
Workspace root: ${config.codebasePath}
Current local time is: ${new Date().toString()} (ISO: ${new Date().toISOString()}).
${promptModifier}

Rules:
- You are in PLAN MODE. Your only goal is to research the codebase and draft/modify a comprehensive step-by-step plan in "ingenium-plan.md".
- You MUST write or update "ingenium-plan.md" in the workspace root using the staged file tools (create_file, modify_file). Do not make any other changes (such as creating other project files or executing commands) yet.
- Tell the user that they can manually edit "ingenium-plan.md" or ask you for any changes.
- Instruct the user that when they are satisfied with the plan, they should type "/execute" to run the plan.
- Be highly analytical and concise.
- Format responses strictly in Markdown.
                `.trim();
        } else {
            instructions = `
You are Ingenium, an expert AI coding assistant.
Workspace root: ${config.codebasePath}
Current local time is: ${new Date().toString()} (ISO: ${new Date().toISOString()}).
${promptModifier}

Rules:
- All file mutations (create, modify, delete) are STAGED and shown to the user for approval. Never claim a file was written; state it was staged.
- Be highly analytical and concise. Omit conversational filler.
- Format responses strictly in Markdown.
- If parameters are ambiguous, halt execution and request clarification.
            `.trim();
        }

        const agent = new ToolLoopAgent({
            model: await getAgentModel(),
            stopWhen: stepCountIs(60),
            instructions,
            tools,
        });

        const result = await agent.generate({
            messages: state.session.messages,
            onStepFinish: ({ toolCalls, toolResults }) => {
                if (!toolCalls || toolCalls.length === 0) return;

                toolCalls.forEach((call, i) => {
                    const target = extractTarget(call.input);
                    const matchingResult = toolResults?.[i];
                    const isError =
                        matchingResult &&
                        typeof matchingResult === "object" &&
                        "error" in (matchingResult as Record<string, unknown>);

                    executedTools.push(
                        `${isError ? "[Failed]" : "[Success]"} <b>${call.toolName}</b> ${target ? `<code>${target}</code>` : ""}`
                    );
                });

                ctx.telegram
                    .editMessageText(
                        chatId,
                        statusMsg.message_id,
                        undefined,
                        `<b>Thinking...</b>\n\n${executedTools.join("\n")}`,
                        { parse_mode: "HTML" }
                    )
                    .catch(() => {});
            },
        });

        // Delete status message
        await ctx.telegram.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

        // Log token usage
        if (result.totalUsage) {
            const usage = result.totalUsage as Record<string, unknown>;
            const prompt =
                typeof usage["inputTokens"] === "number"
                    ? usage["inputTokens"]
                    : typeof usage["promptTokens"] === "number"
                      ? usage["promptTokens"]
                      : 0;
            const completion =
                typeof usage["outputTokens"] === "number"
                    ? usage["outputTokens"]
                    : typeof usage["completionTokens"] === "number"
                      ? usage["completionTokens"]
                      : 0;
            if (prompt > 0 || completion > 0) {
                await logTokenUsage(state.session.id, prompt, completion);
            }
        }

        if (result.text?.trim()) {
            if (state.isTemporaryMode) {
                state.session.messages.push({ role: "assistant", content: result.text });
            } else {
                appendMessage(state.session, { role: "assistant", content: result.text });
            }
            await ctx.reply(result.text, { parse_mode: "Markdown" }).catch(async () => {
                await ctx.reply(result.text);
            });
        }

        state.activeApprovals = { tracker, approvalExecutor };

        if (tracker.hasPendingActions()) {
            const pending = tracker.getPendingMutations();

            // 1. Show individual actions with Inline Buttons
            for (const action of pending) {
                let detailsText = "";
                if (action.type === "tool_execute" && action.details.command) {
                    detailsText = `\nCommand: <code>${action.details.command}</code>`;
                }

                const actionText = `<b>Pending Action:</b>\n• Type: <code>${action.type}</code>\n• Path: <code>${action.path}</code>${detailsText}`;

                const row = [];
                const hasDiff = action.type === "file_modify" || action.type === "file_create";
                if (hasDiff) {
                    row.push(Markup.button.callback("View Diff", `diff_${action.id}`));
                }
                row.push(Markup.button.callback("Approve", `approve_${action.id}`));
                row.push(Markup.button.callback("Reject", `reject_${action.id}`));

                await ctx.reply(actionText, {
                    parse_mode: "HTML",
                    ...Markup.inlineKeyboard([row]),
                });
            }

            // 2. Final control message
            await ctx.reply(
                "<b>Plan Execution Control:</b>\nApply or discard the entire queue of staged actions.",
                {
                    parse_mode: "HTML",
                    ...Markup.inlineKeyboard([
                        [
                            Markup.button.callback("Approve All", "approve_all_actions"),
                            Markup.button.callback("Reject All", "reject_all_actions"),
                        ],
                    ]),
                }
            );
        }
    } catch (err) {
        await ctx.telegram.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
        const message = err instanceof Error ? err.message : String(err);
        await ctx.reply(`<b>Fatal Execution Error:</b>\n${message}`, { parse_mode: "HTML" });
        state.session.messages.pop();
    }
}
