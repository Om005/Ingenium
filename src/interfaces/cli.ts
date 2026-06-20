import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import runAgentMode from "@core/orchestrator.js";

async function runCliMode() {
    const submode = await select({
        message: "Select mode",
        options: [
            { value: "agent", label: "Agent Mode - autonomous, acts on your behalf" },
            { value: "plan", label: "Plan Mode  - proposes steps, you approve each" },
            { value: "exit", label: "Exit" },
        ],
    });

    if (isCancel(submode) || submode === "exit") {
        console.log(chalk.dim("Goodbye."));
        process.exit(0);
    }

    switch (submode) {
        case "agent":
            await runAgentMode();
            break;
        case "plan":
            console.log(chalk.yellow("Plan Mode coming soon."));
            break;
    }
}

export default runCliMode;
