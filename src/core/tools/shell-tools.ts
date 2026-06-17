import type { ActionTracker } from "@core/action/action-tracker.js";
import type { AgentConfig } from "@core/types.js";

export class ShellTools {
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker
    ) {}

    queueShell(command: string): string {
        if (!this.config.tools.allowShellExecution) throw new Error("Shell execution disabled");
        this.tracker.log({
            type: "tool_execute",
            path: "shell",
            details: { command, toolName: "execute_shell" },
            status: "pending",
        });
        return `Shell queued: ${command}`;
    }
}
