import type { ActionTracker } from "@core/action-tracker.js";
import type { AgentConfig } from "@core/types.js";
import { homedir } from "os";
import path from "path";
import fs from "fs";

export class SkillsTools {
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker
    ) {}

    skillRoots(): string[] {
        const extra =
            process.env.SKILLS_DIRS?.split(/[;]/)
                .map((s) => s.trim())
                .filter(Boolean) ?? [];
        return [
            ...extra,
            path.join(homedir(), ".cursor/skills-cursor"),
            path.join(homedir(), ".claude/skills"),
            path.join(homedir(), ".agents/skills"),
        ];
    }

    listSkills(): string {
        const lines: string[] = [];
        for (const root of this.skillRoots()) {
            if (!fs.existsSync(root)) continue;
            const walk = (dir: string) => {
                for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                    const full = path.join(dir, ent.name);
                    if (ent.isDirectory()) walk(full);
                    else if (ent.name === "SKILL.md") lines.push(full);
                }
            };
            walk(root);
        }
        const out = lines.sort().join("\n");
        this.tracker.log({
            type: "code_analysis",
            path: "skills",
            details: { after: out || "(none)", toolName: "list_skills" },
            status: "executed",
        });
        return out || "(none)";
    }

    async readSkill(skillPath: string): Promise<string> {
        const abs = path.isAbsolute(skillPath)
            ? path.normalize(skillPath)
            : path.normalize(path.resolve(this.config.codebasePath, skillPath));
        const allowed = this.skillRoots().some((root) => {
            const r = path.resolve(root);
            return abs === r || abs.startsWith(r + path.sep);
        });
        if (!allowed) throw new Error("read_skill: outside skill roots");
        const text = fs.readFileSync(abs, "utf8");
        this.tracker.log({
            type: "code_analysis",
            path: abs,
            details: { after: text, toolName: "read_skill" },
            status: "executed",
        });
        return text;
    }
}
