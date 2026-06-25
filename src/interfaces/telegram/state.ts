import { defaultAgentConfig } from "../../core/types.js";
import { createSession, type Session } from "../../session/session-manager.js";
import type { ActionTracker } from "../../core/action/action-tracker.js";
import type { ApprovalExecutor } from "../../core/executors/approval-executor.js";

export const config = defaultAgentConfig();

export interface BotState {
    session: Session;
    isPlanMode: boolean;
    isExecutingPlan: boolean;
    isTemporaryMode: boolean;
    activeApprovals: {
        tracker: ActionTracker;
        approvalExecutor: ApprovalExecutor;
    } | null;
}

export const state: BotState = {
    session: createSession(config.codebasePath),
    isPlanMode: false,
    isExecutingPlan: false,
    isTemporaryMode: false,
    activeApprovals: null,
};
