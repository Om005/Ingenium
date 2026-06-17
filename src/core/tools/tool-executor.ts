import type { AgentConfig } from "@core/types.js";
import type { ActionTracker } from "@core/action-tracker.js";
import { FsTools } from "./fs-tools.js";
import { WebTools } from "./web-tools.js";

export class ToolExecutor {
    private overlay = new Map<string, string>();
    private deleted = new Set<string>();

    private fsTools: FsTools;
    private webTools: WebTools;
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker
    ) {
        this.fsTools = new FsTools(config, tracker, {
            overlay: this.overlay,
            deleted: this.deleted,
        });

        this.webTools = new WebTools(config, tracker, {
            overlay: this.overlay,
            deleted: this.deleted,
        });
    }
}
