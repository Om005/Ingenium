import type { AgentConfig } from "@core/types.js";
import type { ActionTracker } from "@core/action-tracker.js";
import { FsTools } from "./fs-tools.js";

export class ToolExecutor {
    private fsTools: FsTools;
    private overlay = new Map<string, string>();
    private deleted = new Set<string>();
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker
    ) {
        this.fsTools = new FsTools(config, tracker, {
            overlay: this.overlay,
            deleted: this.deleted,
        });
    }
}
