import type { ActionTracker } from "@core/action/action-tracker.js";
import type { ActionLog, AgentConfig } from "@core/types.js";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { applyStartProcess, applyStopProcess } from "@core/tools/process-tools.js";

export class ApprovalExecutor {
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker
    ) {}

    private readonly norm = (rel: string) =>
        path.posix.normalize(rel.split(path.sep).join("/")).replace(/^\.\//, "");

    private resolveSafe(rel: string): string {
        const abs = path.resolve(this.config.codebasePath, rel);
        const root = path.resolve(this.config.codebasePath);
        const relCheck = path.relative(root, abs);
        if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
            throw new Error(`Path escapes workspace: ${rel}`);
        }
        return abs;
    }

    applyApprovedFromTracker(): { errors: string[] } {
        const errors: string[] = [];
        const all = [...this.tracker.getActions()];

        for (const a of all.filter((x) => x.type === "folder_create" && x.status === "approved")) {
            try {
                fs.mkdirSync(this.resolveSafe(a.path), { recursive: true });
            } catch (e) {
                errors.push(String(e));
            }
        }

        const fileOps = all
            .filter(
                (a) =>
                    (a.type === "file_create" ||
                        a.type === "file_modify" ||
                        a.type === "file_delete") &&
                    a.status === "approved"
            )
            .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        const lastByPath = new Map<string, ActionLog>();
        for (const a of fileOps) lastByPath.set(this.norm(a.path), a);

        for (const [p, a] of lastByPath) {
            try {
                if (a.type === "file_delete") fs.rmSync(this.resolveSafe(p), { force: true });
                else {
                    const target = this.resolveSafe(p);
                    fs.mkdirSync(path.dirname(target), { recursive: true });
                    fs.writeFileSync(target, a.details.after ?? "", "utf8");
                }
            } catch (e) {
                errors.push(String(e));
            }
        }

        for (const a of all.filter((x) => x.type === "tool_execute" && x.status === "approved")) {
            const cmd = a.details.command;
            if (!cmd) continue;
            try {
                console.log(`Executing command: ${cmd}`);
                if (cmd.startsWith("__start_process__:")) {
                    applyStartProcess(cmd);
                    continue;
                }

                if (cmd.startsWith("__stop_process__:")) {
                    console.log(`Executing command: ${cmd}`);
                    applyStopProcess(cmd);
                    continue;
                }
                const r = spawnSync(cmd, {
                    shell: true,
                    cwd: this.config.codebasePath,
                    encoding: "utf8",
                    maxBuffer: 16 * 1024 * 1024,
                });
                if (r.status && r.status !== 0) errors.push(`shell exit ${r.status}: ${cmd}`);
            } catch (error) {
                errors.push(String(error));
            }
        }

        return { errors };
    }
}
