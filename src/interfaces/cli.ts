import { select, isCancel, intro, outro } from "@clack/prompts";
import chalk from "chalk";
import { runAgentMode, runPlanMode } from "@core/orchestrator.js";
import { runTelegramMode } from "./telegram/index.js";

export default async function runCliMode() {
    console.clear();
    intro(chalk.bgCyan.black.bold(" INGENIUM "));

    const submode = await select({
        message: "Initialize operational mode",
        options: [
            {
                value: "agent",
                label: "Agent Mode",
                hint: "Autonomous execution with staged approvals",
            },
            {
                value: "plan",
                label: "Plan Mode",
                hint: "Sequential proposal and review",
            },
            {
                value: "telegram",
                label: "Telegram Bot Mode",
                hint: "Run Ingenium via Telegram Bot interface",
            },
            {
                value: "exit",
                label: "Exit",
                hint: "Terminate sequence",
            },
        ],
    });

    if (isCancel(submode) || submode === "exit") {
        outro(chalk.dim("System offline."));
        process.exit(0);
    }

    switch (submode) {
        case "agent":
            await runAgentMode();
            break;
        case "plan":
            await runPlanMode();
            break;
        case "telegram":
            await runTelegramMode();
            break;
    }
}
