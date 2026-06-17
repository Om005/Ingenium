import type { ActionTracker } from "@core/action-tracker.js";
import type { AgentConfig } from "@core/types.js";
import type { ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

interface ManagedProcess {
    id: string;
    command: string;
    cwd: string;
    pid: number;
    startedAt: Date;
    logs: string[];
    process: ChildProcess;
    alive: boolean;
}

const registry = new Map<string, ManagedProcess>();
let processCounter = 0;
const MAX_LOG_LINES = 500;

export class ProcessTools {
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker
    ) {}

    private nextId(): string {
        return `proc_${++processCounter}`;
    }

    private appendLog(proc: ManagedProcess, line: string) {
        proc.logs.push(line);
        if (proc.logs.length > MAX_LOG_LINES) {
            proc.logs.shift();
        }
    }

    async listProcesses(): Promise<string> {
        if (registry.size === 0) return "(no processes running)";
        this.tracker.log({
            type: "tool_execute",
            details: { command: "list_processes", toolName: "process_tools" },
            status: "executed",
            path: "N/A",
        });
        return [...registry.values()]
            .map((p) => {
                const status = p.alive ? "running" : "stopped";
                const uptime = Math.floor((Date.now() - p.startedAt.getTime()) / 1000);
                return `[${p.id}] ${status} | pid=${p.pid} | ${uptime}s | ${p.command} (${p.cwd})`;
            })
            .join("\n");
    }

    async readLogs(processId: string, last_n_lines: number): Promise<string> {
        const proc = registry.get(processId);
        if (!proc) return `No process found with id: ${processId}`;

        const lines = proc.logs.slice(-last_n_lines);
        const header = `[${processId}] ${proc.command} — ${proc.alive ? "running" : "stopped"}\n`;
        this.tracker.log({
            type: "tool_execute",
            details: { command: `read_logs: ${processId}`, toolName: "process_tools" },
            status: "executed",
            path: "N/A",
        });
        return header + (lines.length ? lines.join("\n") : "(no output yet)");
    }

    async startProcess(command: string, relPath: string): Promise<string> {
        const cwd = path.isAbsolute(relPath)
            ? relPath
            : path.resolve(this.config.codebasePath, relPath);
        if (!fs.existsSync(cwd)) {
            throw new Error(`start_process: directory not found: ${cwd}`);
        }
        const id = this.nextId();
        this.tracker.log({
            type: "tool_execute",
            path: "process",
            details: {
                command: `__start_process__:${id}:${command}:${cwd}`,
                toolName: "start_process",
            },
            status: "pending",
        });
        return `Staged process start: [${id}] \`${command}\` in ${cwd}\nUse read_logs("${id}") after approval to see output.`;
    }

    async stopProcess(processId: string): Promise<string> {
        const proc = registry.get(processId);
        if (!proc) return `No process found with id: ${processId}`;
        if (!proc.alive) return `Process ${processId} is already stopped.`;
        this.tracker.log({
            type: "tool_execute",
            path: "process",
            details: {
                command: `__stop_process__:${processId}`,
                toolName: "stop_process",
            },
            status: "pending",
        });

        return `Staged process stop: [${processId}] ${proc.command}`;
    }
}
