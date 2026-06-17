import type { AgentConfig } from "@core/types.js";
import type { ActionTracker } from "@core/action/action-tracker.js";
import { FsTools } from "@core/tools/fs-tools.js";
import { WebTools } from "@core/tools/web-tools.js";
import { ShellTools } from "@core/tools/shell-tools.js";
import { GitTools } from "@core/tools/git-tools.js";
import { SkillsTools } from "@core/tools/skills-tools.js";
import { ProcessTools } from "@core/tools/process-tools.js";

export class ToolExecutor {
    private overlay = new Map<string, string>();
    private deleted = new Set<string>();

    private fsTools: FsTools;
    private webTools: WebTools;
    private shellTools: ShellTools;
    private gitTools: GitTools;
    private skillsTools: SkillsTools;
    private processTools: ProcessTools;

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

        this.shellTools = new ShellTools(config, tracker);

        this.gitTools = new GitTools(config, tracker);

        this.skillsTools = new SkillsTools(config, tracker);

        this.processTools = new ProcessTools(config, tracker);
    }
}
