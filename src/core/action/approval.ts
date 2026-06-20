import type { ActionTracker } from "@core/action/action-tracker.js";
import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import type { ActionLog } from "@core/types.js";
import { composeBeforeAfter, formatPatch } from "@tui/diff-view.js";
import { renderTerminalMarkdown } from "@tui/terminal-md.js";

interface ReviewGroup {
    label: string;
    actionIds: string[];
    patch: string | null;
}

function groupPending(pending: ActionLog[]): ReviewGroup[] {
    const byPath = new Map<string, ActionLog[]>();
    const shells: ActionLog[] = [];

    for (const a of pending) {
        if (a.type === "tool_execute") {
            shells.push(a);
            continue;
        }
        const key = a.path;
        if (!byPath.has(key)) byPath.set(key, []);
        byPath.get(key)!.push(a);
    }

    const groups: ReviewGroup[] = [];

    const pathEntries = [...byPath.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [p, acts] of pathEntries) {
        const sorted = acts.sort((x, y) => x.timestamp.getTime() - y.timestamp.getTime());
        const ids = sorted.map((x) => x.id);

        if (sorted.every((x) => x.type === "folder_create")) {
            groups.push({
                label: `Create folder: ${p}`,
                actionIds: ids,
                patch: null,
            });
            continue;
        }

        const { before, after } = composeBeforeAfter(sorted);
        const patch = formatPatch(p, before, after);
        const kinds = [...new Set(sorted.map((x) => x.type))].join(", ");
        groups.push({ label: `${p} (${kinds})`, actionIds: ids, patch });
    }

    for (const s of shells) {
        groups.push({
            label: `Shell: ${s.details.command ?? "(no command)"}`,
            actionIds: [s.id],
            patch: null,
        });
    }

    return groups;
}

export async function runApproval(actionTracker: ActionTracker): Promise<boolean> {
    const pendingActions = actionTracker.getPendingMutations();

    if (pendingActions.length === 0) {
        console.log(chalk.dim("\nNo pending actions to approve.\n"));
        return false;
    }

    const choice = await select({
        message: "Apply staged changes?",
        options: [
            { value: "all", label: "Approve and apply all" },
            { value: "select", label: "Review and approve individually" },
            { value: "reject", label: "Reject all changes" },
        ],
    });

    if (isCancel(choice) || choice === "reject") {
        console.log(chalk.red("\nAll staged changes rejected.\n"));
        actionTracker.getPendingMutations().forEach((action) => {
            actionTracker.updateStatus(action.id, "rejected", false);
        });
        return false;
    }

    if (choice === "all") {
        pendingActions.forEach((action) => {
            actionTracker.updateStatus(action.id, "approved", true);
        });
        console.log(chalk.green("\nAll staged changes approved.\n"));
        return true;
    }

    for (const group of groupPending(pendingActions)) {
        while (true) {
            const opt = await select({
                message: chalk.bold(group.label),
                options: [
                    { value: "accept", label: "Approve" },
                    {
                        value: "diff",
                        label: "View Diff",
                        hint: group.patch ? "" : "No diff available",
                    },
                    { value: "reject", label: "Reject" },
                ],
            });

            if (isCancel(opt)) {
                for (const action of pendingActions) {
                    actionTracker.updateStatus(action.id, "rejected", false);
                }
                return false;
            }

            if (opt === "diff") {
                if (group.patch) {
                    console.log(
                        "\n" + renderTerminalMarkdown("```diff\n" + group.patch + "\n```\n") + "\n"
                    );
                }
                continue;
            }

            for (const id of group.actionIds) {
                actionTracker.updateStatus(
                    id,
                    opt === "accept" ? "approved" : "rejected",
                    opt === "accept"
                );
            }
            break;
        }
    }
    return actionTracker.getActions().some((a) => a.status === "approved");
}
