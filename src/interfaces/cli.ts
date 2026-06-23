import { select, isCancel, intro, outro } from "@clack/prompts";
import chalk from "chalk";
import { runAgentMode, runPlanMode } from "@core/orchestrator.js";

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
                hint: "Plan proposal and review",
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
    }
}
