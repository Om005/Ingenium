import { text, isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "@core/types.js";
import { ActionTracker } from "@core/action/action-tracker.js";
import { ToolExecutor } from "@core/executors/tool-executor.js";
import { createAgentTools } from "@core/agent/tools.js";
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

const EXIT_COMMANDS = new Set(["exit", "quit", "q", "bye", ":q"]);

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
        message: "Session",
        options: [
            { value: "__new__", label: "New session" },
            ...existing.slice(0, 8).map((s) => ({
                value: s.id,
                label: `${s.title}  ${chalk.dim(formatRelativeTime(s.updatedAt))}  ${chalk.dim(`(${Math.floor(s.messageCount / 2)} exchanges)`)}`,
            })),
        ],
    });

    if (isCancel(choice)) {
        console.log(chalk.dim("Goodbye."));
        process.exit(0);
    }
    if (choice === "__new__") {
        return createSession(projectPath);
    }

    const loaded = loadSession(projectPath, choice as string);
    if (!loaded) {
        console.log(chalk.yellow("Session not found, starting fresh."));
        return createSession(projectPath);
    }

    console.log(
        chalk.dim(
            `\nResuming: "${loaded.title}" — ${Math.floor(loaded.messages.length / 2)} previous exchanges\n`
        )
    );
    return loaded;
}

async function runAgentMode() {
    console.log(chalk.bold.cyan("\n┌─ Agent Mode ───────────────────────────────┐"));
    console.log(chalk.dim("│  Multi-turn session. Type 'exit' to quit.  │"));
    console.log(chalk.bold.cyan("└────────────────────────────────────────────┘\n"));

    const config = defaultAgentConfig();
    const session = await pickSession(config.codebasePath);
    const tracker = new ActionTracker();
    const approvalExecutor = new ApprovalExecutor(config, tracker);
    const executor = new ToolExecutor(config, tracker);
    const tools = createAgentTools(executor);

    const agent = new ToolLoopAgent({
        model: await getAgentModel(),
        stopWhen: stepCountIs(30),
        instructions: `
You are Ingenium, an expert AI coding assistant running locally on the user's machine.
Workspace root: ${config.codebasePath}

Rules:
- All file mutations (create, modify, delete) are STAGED and shown to the user for approval before being applied. Never tell the user a file was written - say it was staged.
- Be concise. No fluff. Format responses in Markdown.
- If you are unsure about something, ask before acting.
        `.trim(),
        tools,
    });

    while (true) {
        const input = await text({
            message: chalk.green("Command:"),
            placeholder: "What do you want to do? (exit to quit)",
        });

        if (isCancel(input) || EXIT_COMMANDS.has((input as string).trim().toLowerCase())) {
            console.log(chalk.dim("\nSession ended. Goodbye.\n"));
            break;
        }

        const userMessage = (input as string).trim();
        if (!userMessage) continue;

        appendMessage(session, { role: "user", content: userMessage });

        executor.clearStaging();
        tracker.clear();

        console.log(chalk.dim("\nThinking...\n"));

        try {
            const result = await agent.generate({
                messages: session.messages,
                onStepFinish: ({ toolCalls }) => {
                    for (const call of toolCalls) {
                        const preview = JSON.stringify(call.input).slice(0, 120);
                        console.log(
                            chalk.cyan("  ⚙"),
                            chalk.bold(call.toolName),
                            chalk.dim(preview + (preview.length >= 120 ? "..." : ""))
                        );
                    }
                },
            });

            if (result.text?.trim()) {
                appendMessage(session, { role: "assistant", content: result.text });
                console.log("\n" + renderTerminalMarkdown(result.text) + "\n");
            }

            if (tracker.hasPendingActions()) {
                await runApproval(tracker);

                const { errors } = approvalExecutor.applyApprovedFromTracker();

                if (errors.length) {
                    console.log(chalk.red("\n✗ Some actions failed:\n"));
                    errors.forEach((e) => console.log(chalk.red(`  - ${e}`)));
                } else {
                    console.log(chalk.green("✓ Applied.\n"));
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(chalk.red(`\n✗ Error: ${message}\n`));
            session.messages.pop();
        }
    }
}

export default runAgentMode;
