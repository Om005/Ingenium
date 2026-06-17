import { tool } from "ai";
import { z } from "zod";
import type { ToolExecutor } from "@core/executors/tool-executor.js";

export function createAgentTools(executor: ToolExecutor) {
    return {
        read_file: tool({
            description:
                "Read a text file from the workspace. Use a path relative to the project root.",
            inputSchema: z.object({
                path: z.string().describe("Relative file path"),
            }),
            execute: async ({ path }) => {
                return executor.fsTools.readFile(path);
            },
        }),
        create_file: tool({
            description: "Stage creation of a new file (not written until the user approves).",
            inputSchema: z.object({
                path: z.string(),
                content: z.string(),
            }),
            execute: async ({ path, content }) => executor.fsTools.createFile(path, content),
        }),
        modify_file: tool({
            description: "Stage a full-file replacement for an existing file (pending approval).",
            inputSchema: z.object({
                path: z.string(),
                content: z.string().describe("Complete new file contents"),
            }),
            execute: async ({ path, content }) => executor.fsTools.modifyFile(path, content),
        }),
        delete_file: tool({
            description: "Stage deletion of a file (pending approval).",
            inputSchema: z.object({
                path: z.string(),
            }),
            execute: async ({ path }) => executor.fsTools.deleteFile(path),
        }),
        create_folder: tool({
            description:
                "Stage creation of a directory tree (pending approval). Uses mkdir -p on apply.",
            inputSchema: z.object({
                path: z.string().describe("Relative directory path"),
            }),
            execute: async ({ path }) => executor.fsTools.createFolder(path),
        }),

        list_files: tool({
            description: "List files and directories under a path.",
            inputSchema: z.object({
                path: z.string(),
                recursive: z.boolean().optional().default(false),
            }),
            execute: async ({ path, recursive }) => executor.fsTools.listFiles(path, recursive),
        }),

        search_files: tool({
            description:
                'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
            inputSchema: z.object({
                root: z.string().describe("Directory to search, relative to root"),
                pattern: z.string().describe("Glob-like pattern using * and ** (forward slashes)"),
                content_contains: z.string().optional(),
            }),
            execute: async ({ root, pattern, content_contains }) =>
                executor.fsTools.searchFiles(root, pattern, content_contains),
        }),

        analyze_codebase: tool({
            description: "Summarize structure: file counts, size, extensions. Read-only.",
            inputSchema: z.object({
                path: z.string().default("."),
            }),
            execute: async ({ path }) => executor.fsTools.analyzeCodebase(path),
        }),

        execute_shell: tool({
            description:
                "Queue a shell command to run in the workspace after user approval. Use with care.",
            inputSchema: z.object({
                command: z.string().describe("Single command; runs with shell: true"),
            }),
            execute: async ({ command }) => executor.shellTools.queueShell(command),
        }),

        list_skills: tool({
            description:
                "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
            inputSchema: z.object({}),
            execute: async () => executor.skillsTools.listSkills(),
        }),

        read_skill: tool({
            description:
                "Read a SKILL.md file. Path must be absolute and under skill roots, or use a path returned by list_skills.",
            inputSchema: z.object({
                path: z.string(),
            }),
            execute: async ({ path }) => executor.skillsTools.readSkill(path),
        }),

        web_search: tool({
            description:
                "Search the web for current information, documentation, Stack Overflow answers, GitHub issues, etc. Returns a list of results with title, url, and a clean content summary.",
            inputSchema: z.object({
                query: z.string().describe("Search query"),
                max_results: z
                    .number()
                    .int()
                    .min(1)
                    .max(10)
                    .default(5)
                    .describe("Number of results to return"),
                topic: z
                    .enum(["general", "news"])
                    .default("general")
                    .describe("general for docs/code, news for recent events"),
            }),
            execute: async ({ query, max_results, topic }) =>
                executor.webTools.webSearch(query, max_results, topic),
        }),

        web_fetch: tool({
            description:
                "Fetch and extract clean text content from a specific URL. Use this when you have an exact URL (from search results, user input, or documentation links) and need its full content.",
            inputSchema: z.object({
                url: z.string().url().describe("The URL to fetch"),
            }),
            execute: async ({ url }) => executor.webTools.webFetch(url),
        }),

        git_status: tool({
            description:
                "Show the working tree status — staged files, unstaged changes, untracked files, and current branch.",
            inputSchema: z.object({
                repoPath: z.string().optional().describe("Path to the git repository"),
            }),
            execute: async ({ repoPath }) => executor.gitTools.gitStatus(repoPath),
        }),

        git_diff: tool({
            description:
                "Show diffs. By default shows unstaged changes. Pass staged: true to see staged changes. Pass a file path to diff a specific file.",
            inputSchema: z.object({
                repoPath: z.string().optional().describe("Path to the git repository"),
                staged: z.boolean().optional().default(false),
                filePath: z.string().optional().describe("Specific file to diff (optional)"),
            }),
            execute: async ({ repoPath, staged, filePath }) =>
                executor.gitTools.gitDiff(repoPath, staged, filePath),
        }),

        git_log: tool({
            description: "Show recent commit history.",
            inputSchema: z.object({
                repoPath: z.string().optional().describe("Path to the git repository"),
                limit: z
                    .number()
                    .int()
                    .min(1)
                    .max(50)
                    .default(10)
                    .describe("Number of commits to show"),
            }),
            execute: async ({ repoPath, limit }) => executor.gitTools.gitLog(repoPath, limit),
        }),

        git_branches: tool({
            description: "List all local branches and highlight the current one.",
            inputSchema: z.object({
                repoPath: z.string().optional().describe("Path to the git repository"),
            }),
            execute: async ({ repoPath }) => executor.gitTools.gitBranches(repoPath),
        }),

        git_commit: tool({
            description:
                "Stage all changes (git add -A) and commit with a message. Queued for user approval before running.",
            inputSchema: z.object({
                message: z.string().describe("Commit message"),
                repoPath: z.string().optional().describe("Path to the git repository"),
                add_all: z.boolean().default(true).describe("Run git add -A before committing"),
            }),
            execute: async ({ message, repoPath, add_all }) =>
                executor.gitTools.gitCommit(message, repoPath, add_all),
        }),

        git_checkout: tool({
            description:
                "Switch to an existing branch or create a new one. Queued for user approval.",
            inputSchema: z.object({
                branch: z.string().describe("Branch name"),
                repoPath: z.string().optional().describe("Path to the git repository"),
                create: z
                    .boolean()
                    .default(false)
                    .describe("Create the branch if it does not exist (-b flag)"),
            }),
            execute: async ({ branch, repoPath, create }) =>
                executor.gitTools.gitCheckout(branch, repoPath, create),
        }),

        git_push: tool({
            description: "Push current branch to remote. Queued for user approval.",
            inputSchema: z.object({
                remote: z.string().default("origin").describe("Remote name"),
                force: z.boolean().default(false).describe("Force push — use with caution"),
                repoPath: z.string().optional().describe("Path to the git repository"),
            }),
            execute: async ({ remote, force, repoPath }) =>
                executor.gitTools.gitPush(remote, repoPath, force),
        }),

        list_processes: tool({
            description: "List all processes started in this session with their status and PID.",
            inputSchema: z.object({}),
            execute: async () => executor.processTools.listProcesses(),
        }),

        read_logs: tool({
            description:
                "Read buffered stdout/stderr output from a running or recently stopped process.",
            inputSchema: z.object({
                id: z.string().describe("Process ID returned by start_process"),
                last_n_lines: z
                    .number()
                    .int()
                    .min(1)
                    .max(200)
                    .default(50)
                    .describe("How many recent lines to return"),
            }),
            execute: async ({ id, last_n_lines }) =>
                executor.processTools.readLogs(id, last_n_lines),
        }),

        start_process: tool({
            description:
                "Start a long-running background process (dev server, watcher, etc). Returns a process ID you can use with read_logs and stop_process. Queued for user approval.",
            inputSchema: z.object({
                command: z.string().describe("Command to run, e.g. 'pnpm dev' or 'npm start'"),
                path: z
                    .string()
                    .describe(
                        "Directory to run the command in, relative to workspace root. E.g. 'client' or 'server'"
                    ),
            }),
            execute: async ({ command, path }) => executor.processTools.startProcess(command, path),
        }),

        stop_process: tool({
            description: "Kill a running process by its ID. Queued for user approval.",
            inputSchema: z.object({
                id: z.string().describe("Process ID to stop"),
            }),
            execute: async ({ id }) => executor.processTools.stopProcess(id),
        }),
    };
}
