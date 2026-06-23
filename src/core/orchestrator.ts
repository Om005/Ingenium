import { text, isCancel, select, spinner, note, outro, log } from "@clack/prompts";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { defaultAgentConfig } from "@core/types.js";
import { ActionTracker } from "@core/action/action-tracker.js";
import { ToolExecutor } from "@core/executors/tool-executor.js";
import { createAgentTools } from "@core/agent/tools.js";
import { reminderScheduler } from "../utils/reminder-scheduler.js";
import { setSetting, getSetting, getAgentSystemPromptModifier } from "../utils/settings-service.js";
import {
    logTokenUsage,
    getSessionUsageSummary,
    getGlobalUsageSummary,
} from "../utils/token-logger.js";
import { stepCountIs, ToolLoopAgent } from "ai";
import getAgentModel from "@providers/openrouter.js";
import { renderTerminalMarkdown } from "@tui/terminal-md.js";
import { ApprovalExecutor } from "@core/executors/approval-executor.js";
import {
    appendMessage,
    createSession,
    listSessions,
    loadSession,
    type Session,
} from "@session/session-manager.js";
import { runApproval } from "@core/action/approval.js";

const EXIT_COMMANDS = new Set(["/exit", "quit", "q", "bye", ":q"]);

function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

async function pickSession(projectPath: string): Promise<Session> {
    const existing = listSessions(projectPath);

    if (existing.length === 0) {
        return createSession(projectPath);
    }

    const choice = await select({
        message: "Target Session",
        options: [
            { value: "__new__", label: "Create new session" },
            ...existing.slice(0, 8).map((s) => ({
                value: s.id,
                label: `${s.title}  ${chalk.dim(formatRelativeTime(s.updatedAt))}  ${chalk.dim(`(${Math.floor(s.messageCount / 2)} turns)`)}`,
            })),
        ],
    });

    if (isCancel(choice)) {
        outro(chalk.dim("System offline."));
        process.exit(0);
    }

    if (choice === "__new__") {
        return createSession(projectPath);
    }

    const loaded = loadSession(projectPath, choice as string);
    if (!loaded) {
        note("Session corrupted or missing. Initiating fresh workspace.", "Warning");
        return createSession(projectPath);
    }

    note(
        `Restored context: ${Math.floor(loaded.messages.length / 2)} previous exchanges.`,
        `Session: ${loaded.title}`
    );
    return loaded;
}

async function handleLocalCommands(
    input: string,
    session: Session,
    tracker: ActionTracker,
    state: { isTemporary: boolean }
): Promise<Session | null> {
    const cleanInput = input.trim();
    const cmd = cleanInput.split(" ")[0]!.toLowerCase();

    if (cmd === "/sessions") {
        const newSession = await pickSession(session.projectPath);
        return newSession;
    }

    if (cmd === "/clear") {
        session.messages = [];
        tracker.clear();
        log.success("Context wiped. Memory is clear.");
        return session;
    }

    if (cmd === "/style") {
        const parts = cleanInput.split(/\s+/);
        let targetStyle = parts[1]?.toLowerCase();

        if (
            !targetStyle ||
            !["default", "formal", "descriptive", "concise"].includes(targetStyle)
        ) {
            targetStyle = (await select({
                message: "Choose Agent Writing Style / Persona:",
                options: [
                    { value: "default", label: "Default", hint: "Standard balanced responses" },
                    { value: "concise", label: "Concise", hint: "Code-centric, short and direct" },
                    {
                        value: "descriptive",
                        label: "Descriptive",
                        hint: "Detailed explanations and logic breakdowns",
                    },
                    {
                        value: "formal",
                        label: "Formal",
                        hint: "Academic and professional phrasing",
                    },
                ],
            })) as string;
        }

        if (isCancel(targetStyle)) return session;

        await setSetting("writing_style", targetStyle);
        log.success(`Agent style updated to: ${chalk.cyan(targetStyle.toUpperCase())}`);
        return session;
    }

    if (cmd === "/instructions") {
        const instText = cleanInput.slice("/instructions".length).trim();
        if (!instText) {
            const current = await getSetting("custom_instructions", "");
            console.log(
                `\n${chalk.bold("Current Custom Instructions:")}\n${current || chalk.dim("(none)")}\n`
            );

            const newInst = await text({
                message: "Enter new custom instructions (or press enter/ESC to keep current):",
                placeholder: "e.g. Always write ESM modules, use tab indentation...",
            });

            if (isCancel(newInst) || newInst === undefined) return session;

            if (newInst.trim()) {
                await setSetting("custom_instructions", newInst.trim());
                log.success("Custom instructions updated.");
            }
        } else {
            await setSetting("custom_instructions", instText);
            log.success("Custom instructions updated.");
        }
        return session;
    }

    if (cmd === "/clear_instructions" || cmd === "/clear-instructions") {
        await setSetting("custom_instructions", "");
        log.success("Custom instructions cleared.");
        return session;
    }

    if (cmd === "/analytics" || cmd === "/usage") {
        const sessionSummary = await getSessionUsageSummary(session.id);
        const globalSummary = await getGlobalUsageSummary();

        const formatNum = (n: number) => n.toLocaleString();

        console.log(`
  ${chalk.bgCyan.black.bold(" INGENIUM TOKEN ANALYTICS ")}
  
  ${chalk.bold("Current Session Usage:")}
  ┌──────────────────┬──────────────────────────┐
  │ Prompt Tokens    │ ${chalk.cyan(formatNum(sessionSummary.totalPrompt).padEnd(24))} │
  │ Comp. Tokens     │ ${chalk.cyan(formatNum(sessionSummary.totalCompletion).padEnd(24))} │
  │ Total Tokens     │ ${chalk.cyan(formatNum(sessionSummary.totalTokens).padEnd(24))} │
  └──────────────────┴──────────────────────────┘
  
  ${chalk.bold("Global Lifetime Usage:")}
  ┌──────────────────┬──────────────────────────┐
  │ Total Queries    │ ${chalk.cyan(formatNum(globalSummary.count).padEnd(24))} │
  │ Prompt Tokens    │ ${chalk.cyan(formatNum(globalSummary.totalPrompt).padEnd(24))} │
  │ Comp. Tokens     │ ${chalk.cyan(formatNum(globalSummary.totalCompletion).padEnd(24))} │
  │ Total Tokens     │ ${chalk.cyan(formatNum(globalSummary.totalTokens).padEnd(24))} │
  └──────────────────┴──────────────────────────┘
        `);
        return session;
    }

    if (cmd === "/temporary" || cmd === "/temp") {
        state.isTemporary = !state.isTemporary;
        if (state.isTemporary) {
            log.warn("Temporary Mode ENABLED. Conversation logs will NOT be saved to disk.");
        } else {
            log.success("Temporary Mode DISABLED. Conversation logs will be saved to disk.");
        }
        return session;
    }

    if (cmd === "/help") {
        const helpText = `
    ${chalk.bold("Available Local Commands:")}
    ${chalk.cyan("/help")}               - Show this menu
    ${chalk.cyan("/sessions")}           - Switch or create sessions
    ${chalk.cyan("/clear")}              - Wipe current session memory
    ${chalk.cyan("/style [name]")}       - Change writing style (concise, descriptive, formal, default)
    ${chalk.cyan("/instructions [text]")} - Set custom guidelines for response formatting
    ${chalk.cyan("/clear_instructions")}  - Reset custom instructions
    ${chalk.cyan("/analytics")}          - Display token usage and cost metrics
    ${chalk.cyan("/temporary")}          - Toggle transient mode (don't save logs to disk)
    ${chalk.cyan("/exit")}               - Terminate the agent
        `.trim();
        console.log(`\n${helpText}\n`);
        return session;
    }

    return null;
}

function printToolLine(
    toolName: string,
    target: string,
    status: "ok" | "error",
    detail?: string
): void {
    const icon = status === "ok" ? chalk.green("✓") : chalk.red("✗");
    const name = chalk.cyan.bold(toolName);
    const dim = target ? chalk.dim(`  ${target}`) : "";
    const extra = detail ? chalk.dim(`  ${detail}`) : "";
    console.log(`  ${icon} ${name}${dim}${extra}`);
}

function extractTarget(input: unknown): string {
    if (!input || typeof input !== "object") return "";
    const obj = input as Record<string, unknown>;

    const value =
        obj.command ?? obj.query ?? obj.message ?? obj.url ?? obj.branch ?? obj.id ?? obj.path;

    if (value === undefined || value === null) return "";

    const str = String(value);
    return str.length > 70 ? str.slice(0, 70) + "..." : str;
}

export async function runAgentMode() {
    const config = defaultAgentConfig();
    let session = await pickSession(config.codebasePath);

    const tracker = new ActionTracker();
    const approvalExecutor = new ApprovalExecutor(config, tracker);
    const executor = new ToolExecutor(config, tracker);
    const tools = createAgentTools(executor);

    await reminderScheduler.init();

    const state = { isTemporary: false };

    while (true) {
        const input = await text({
            message: chalk.green.bold(state.isTemporary ? "temp❯" : "❯"),
            placeholder: "Input objective or slash command...",
        });

        if (isCancel(input) || EXIT_COMMANDS.has((input as string).trim().toLowerCase())) {
            outro(chalk.dim("Session terminated."));
            break;
        }

        const userMessage = (input as string).trim();
        if (!userMessage) continue;

        if (userMessage.startsWith("/")) {
            const newSession = await handleLocalCommands(userMessage, session, tracker, state);
            if (newSession) {
                session = newSession;
                continue;
            }
        }

        if (state.isTemporary) {
            session.messages.push({ role: "user", content: userMessage });
        } else {
            appendMessage(session, { role: "user", content: userMessage });
        }

        executor.clearStaging();
        tracker.clear();

        console.log();

        let execSpinner = spinner();
        execSpinner.start("Thinking...");

        try {
            const promptModifier = await getAgentSystemPromptModifier();
            const agent = new ToolLoopAgent({
                model: await getAgentModel(),
                stopWhen: stepCountIs(60),
                instructions: `
You are Ingenium, an expert AI coding assistant.
Workspace root: ${config.codebasePath}
Current local time is: ${new Date().toString()} (ISO: ${new Date().toISOString()}).
${promptModifier}

Rules:
- All file mutations (create, modify, delete) are STAGED and shown to the user for approval. Never claim a file was written; state it was staged.
- Be highly analytical and concise. Omit conversational filler.
- Format responses strictly in Markdown.
- If parameters are ambiguous, halt execution and request clarification.
                `.trim(),
                tools,
            });

            const result = await agent.generate({
                messages: session.messages,
                onStepFinish: ({ toolCalls, toolResults }) => {
                    if (!toolCalls || toolCalls.length === 0) return;

                    execSpinner.stop();

                    toolCalls.forEach((call, i) => {
                        const target = extractTarget(call.input);

                        const matchingResult = toolResults?.[i];
                        const isError =
                            matchingResult &&
                            typeof matchingResult === "object" &&
                            "error" in (matchingResult as Record<string, unknown>);

                        printToolLine(call.toolName, target, isError ? "error" : "ok");
                    });

                    execSpinner = spinner();
                    execSpinner.start(chalk.dim("Thinking..."));
                },
            });

            execSpinner.stop("Analysis complete.");

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
                    await logTokenUsage(session.id, prompt, completion);
                }
            }

            if (result.text?.trim()) {
                if (state.isTemporary) {
                    session.messages.push({ role: "assistant", content: result.text });
                } else {
                    appendMessage(session, { role: "assistant", content: result.text });
                }
                console.log("\n" + renderTerminalMarkdown(result.text) + "\n");
            }

            if (tracker.hasPendingActions()) {
                await runApproval(tracker);

                const { errors } = approvalExecutor.applyApprovedFromTracker();

                if (errors.length) {
                    note(errors.map((e) => `• ${e}`).join("\n"), "Execution Failures");
                } else {
                    log.success("All approved mutations applied successfully.");
                }
            }
        } catch (err) {
            execSpinner.stop(chalk.red("Execution failed."));
            const message = err instanceof Error ? err.message : String(err);
            note(message, "Fatal Error");
            session.messages.pop();
        }
    }
}

export async function runPlanMode() {
    const config = defaultAgentConfig();
    let session = await pickSession(config.codebasePath);

    const tracker = new ActionTracker();
    const approvalExecutor = new ApprovalExecutor(config, tracker);
    const executor = new ToolExecutor(config, tracker);
    const tools = createAgentTools(executor);

    await reminderScheduler.init();

    let isExecuting = false;
    const state = { isTemporary: false };

    while (true) {
        const input = await text({
            message: chalk.green.bold(state.isTemporary ? "temp_plan❯" : "plan❯"),
            placeholder: isExecuting
                ? "Input objective or command..."
                : "Describe query or type /execute to run the plan...",
        });

        if (isCancel(input) || EXIT_COMMANDS.has((input as string).trim().toLowerCase())) {
            outro(chalk.dim("Plan session terminated."));
            break;
        }

        const userMessage = (input as string).trim();
        if (!userMessage) continue;

        if (userMessage.startsWith("/")) {
            const cmd = userMessage.toLowerCase();
            if (cmd === "/execute") {
                const planPath = path.join(config.codebasePath, "ingenium-plan.md");
                if (!fs.existsSync(planPath)) {
                    note(
                        "No `ingenium-plan.md` file found in the workspace root. Please generate a plan first.",
                        "Error"
                    );
                    continue;
                }

                const planContent = fs.readFileSync(planPath, "utf8");
                log.info("Executing approved plan from `ingenium-plan.md`...");
                isExecuting = true;

                if (state.isTemporary) {
                    session.messages.push({
                        role: "user",
                        content: `Plan Execution Request: Please read and execute the approved plan from "ingenium-plan.md" step-by-step. Here is the current content of "ingenium-plan.md":\n\n${planContent}`,
                    });
                } else {
                    appendMessage(session, {
                        role: "user",
                        content: `Plan Execution Request: Please read and execute the approved plan from "ingenium-plan.md" step-by-step. Here is the current content of "ingenium-plan.md":\n\n${planContent}`,
                    });
                }
            } else {
                const newSession = await handleLocalCommands(userMessage, session, tracker, state);
                if (newSession) {
                    session = newSession;
                    continue;
                }
            }
        } else {
            if (state.isTemporary) {
                session.messages.push({ role: "user", content: userMessage });
            } else {
                appendMessage(session, { role: "user", content: userMessage });
            }
        }

        if (userMessage.startsWith("/") && userMessage.toLowerCase() !== "/execute") {
            continue;
        }

        executor.clearStaging();
        tracker.clear();

        console.log();

        let execSpinner = spinner();
        execSpinner.start("Thinking...");

        try {
            const promptModifier = await getAgentSystemPromptModifier();
            const agentInstructions = isExecuting
                ? `
You are Ingenium, an expert AI coding assistant.
Workspace root: ${config.codebasePath}
Current local time is: ${new Date().toString()} (ISO: ${new Date().toISOString()}).
${promptModifier}

Rules:
- You are in EXECUTION MODE. You must execute the approved plan from "ingenium-plan.md" step-by-step using your tools (file creation, modification, shell commands, etc.).
- All file mutations are STAGED and shown to the user for approval. Never claim a file was written; state it was staged.
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

            const agent = new ToolLoopAgent({
                model: await getAgentModel(),
                stopWhen: stepCountIs(60),
                instructions: agentInstructions,
                tools,
            });

            const result = await agent.generate({
                messages: session.messages,
                onStepFinish: ({ toolCalls, toolResults }) => {
                    if (!toolCalls || toolCalls.length === 0) return;

                    execSpinner.stop();

                    toolCalls.forEach((call, i) => {
                        const target = extractTarget(call.input);

                        const matchingResult = toolResults?.[i];
                        const isError =
                            matchingResult &&
                            typeof matchingResult === "object" &&
                            "error" in (matchingResult as Record<string, unknown>);

                        printToolLine(call.toolName, target, isError ? "error" : "ok");
                    });

                    execSpinner = spinner();
                    execSpinner.start(chalk.dim("Thinking..."));
                },
            });

            execSpinner.stop("Analysis complete.");

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
                    await logTokenUsage(session.id, prompt, completion);
                }
            }

            if (result.text?.trim()) {
                if (state.isTemporary) {
                    session.messages.push({ role: "assistant", content: result.text });
                } else {
                    appendMessage(session, { role: "assistant", content: result.text });
                }
                console.log("\n" + renderTerminalMarkdown(result.text) + "\n");
            }

            if (tracker.hasPendingActions()) {
                await runApproval(tracker);

                const { errors } = approvalExecutor.applyApprovedFromTracker();

                if (errors.length) {
                    note(errors.map((e) => `• ${e}`).join("\n"), "Execution Failures");
                } else {
                    log.success("All approved mutations applied successfully.");
                }
            }
        } catch (err) {
            execSpinner.stop(chalk.red("Execution failed."));
            const message = err instanceof Error ? err.message : String(err);
            note(message, "Fatal Error");
            session.messages.pop();
        }
    }
}
