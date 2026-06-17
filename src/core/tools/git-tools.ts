import type { ActionTracker } from "@core/action/action-tracker.js";
import type { AgentConfig } from "@core/types.js";
import { execSync } from "child_process";
import path from "path";

export class GitTools {
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker
    ) {}

    private readonly norm = (rel: string) =>
        path.posix.normalize(rel.split(path.sep).join("/")).replace(/^\.\//, "");

    private resolveCwd(inputPath?: string): string {
        if (!inputPath) return this.config.codebasePath;
        if (path.isAbsolute(inputPath)) return inputPath;
        return path.resolve(this.config.codebasePath, inputPath);
    }

    git(args: string, cwd: string): string {
        try {
            return execSync(`git ${args}`, {
                cwd,
                encoding: "utf8",
                stdio: ["pipe", "pipe", "pipe"],
            }).trim();
        } catch (err: unknown) {
            throw new Error(`git ${args.split(" ")[0]} failed`, { cause: err });
        }
    }

    async gitStatus(repoPath: string): Promise<string> {
        const cwd = this.resolveCwd(repoPath);
        const branch = this.git("rev-parse --abbrev-ref HEAD", cwd);
        const status = this.git("status --short", cwd);
        this.tracker.log({
            type: "tool_execute",
            details: { command: "git_status", toolName: "git_status" },
            status: "executed",
            path: cwd,
        });
        return `Branch: ${branch}\n\n${status || "(clean — nothing to commit)"}`;
    }

    async gitDiff(repoPath?: string, staged = false, filePath?: string): Promise<string> {
        const cwd = this.resolveCwd(repoPath);
        const stagedFlag = staged ? "--staged" : "";
        const pathArg = filePath ? `-- ${filePath}` : "";
        this.tracker.log({
            type: "tool_execute",
            details: { command: "git_diff", toolName: "git_diff" },
            status: "executed",
            path: cwd,
        });
        return this.git(`diff ${stagedFlag} ${pathArg}`.trim(), cwd) || "(no changes)";
    }

    async gitLog(repoPath?: string, limit = 10): Promise<string> {
        const cwd = this.resolveCwd(repoPath);
        this.tracker.log({
            type: "tool_execute",
            details: { command: "git_log", toolName: "git_log" },
            status: "executed",
            path: cwd,
        });
        return this.git(`log --oneline --graph --decorate -${limit}`, cwd);
    }

    async gitBranches(repoPath?: string): Promise<string> {
        const cwd = this.resolveCwd(repoPath);
        this.tracker.log({
            type: "tool_execute",
            details: { command: "git_branches", toolName: "git_branches" },
            status: "executed",
            path: cwd,
        });
        return this.git("branch -v", cwd);
    }

    async gitCommit(message: string, repoPath?: string, addAll = true): Promise<string> {
        const cwd = this.resolveCwd(repoPath);
        const command = addAll
            ? `git add -A && git commit -m ${JSON.stringify(message)}`
            : `git commit -m ${JSON.stringify(message)}`;
        this.tracker.log({
            type: "tool_execute",
            path: cwd,
            details: { command, toolName: "git_commit" },
            status: "pending",
        });
        return `Staged git commit: "${message}" in ${cwd}`;
    }

    async gitCheckout(branch: string, repoPath?: string, create = false): Promise<string> {
        const cwd = this.resolveCwd(repoPath);
        const command = create ? `git checkout -b ${branch}` : `git checkout ${branch}`;
        this.tracker.log({
            type: "tool_execute",
            path: cwd,
            details: { command, toolName: "git_checkout" },
            status: "pending",
        });
        return `Staged checkout: ${branch} in ${cwd}`;
    }

    async gitPush(remote = "origin", repoPath?: string, force = false): Promise<string> {
        const cwd = this.resolveCwd(repoPath);
        const branch = this.git("rev-parse --abbrev-ref HEAD", cwd);
        const forceFlag = force ? "--force-with-lease" : "";
        const command = `git push ${remote} ${branch} ${forceFlag}`.trim();
        this.tracker.log({
            type: "tool_execute",
            path: cwd,
            details: { command, toolName: "git_push" },
            status: "pending",
        });
        return `Staged push: ${remote}/${branch} in ${cwd}`;
    }
}
