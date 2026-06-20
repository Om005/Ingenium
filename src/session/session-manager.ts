import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { homedir } from "node:os";
import type { ModelMessage } from "ai";

export interface Session {
    id: string;
    projectPath: string;
    createdAt: string;
    updatedAt: string;
    title: string;
    messages: ModelMessage[];
}

export interface SessionMeta {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
}

const INGENIUM_DIR = path.join(homedir(), ".ingenium");

function projectSessionsDir(projectPath: string): string {
    const hash = crypto
        .createHash("sha256")
        .update(path.resolve(projectPath))
        .digest("hex")
        .slice(0, 12);
    return path.join(INGENIUM_DIR, "sessions", hash);
}

function sessionFile(projectPath: string, sessionId: string): string {
    return path.join(projectSessionsDir(projectPath), `${sessionId}.json`);
}

function ensureDir(dir: string): void {
    fs.mkdirSync(dir, { recursive: true });
}

export function createSession(projectPath: string): Session {
    const session: Session = {
        id: crypto.randomUUID(),
        projectPath: path.resolve(projectPath),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: "New session",
        messages: [],
    };
    saveSession(session);
    return session;
}

export function appendMessage(session: Session, message: ModelMessage): void {
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();

    if (session.title === "New session" && message.role === "user") {
        const text =
            typeof message.content === "string" ? message.content : JSON.stringify(message.content);
        session.title = text.slice(0, 60) + (text.length > 60 ? "..." : "");
    }

    saveSession(session);
}

export function saveSession(session: Session): void {
    if (session.messages.length === 0) return;
    const dir = projectSessionsDir(session.projectPath);
    ensureDir(dir);
    fs.writeFileSync(
        sessionFile(session.projectPath, session.id),
        JSON.stringify(session, null, 2),
        "utf8"
    );
}

export function loadSession(projectPath: string, sessionId: string): Session | null {
    const file = sessionFile(projectPath, sessionId);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8")) as Session;
    } catch {
        return null;
    }
}

export function loadLastSession(projectPath: string): Session | null {
    const sessions = listSessions(projectPath);
    if (!sessions || sessions.length === 0) return null;
    return loadSession(projectPath, sessions[0]!.id);
}

export function listSessions(projectPath: string): SessionMeta[] {
    const dir = projectSessionsDir(projectPath);
    if (!fs.existsSync(dir)) return [];

    return fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
            try {
                const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Session;
                return {
                    id: raw.id,
                    title: raw.title,
                    createdAt: raw.createdAt,
                    updatedAt: raw.updatedAt,
                    messageCount: raw.messages.length,
                } satisfies SessionMeta;
            } catch {
                return null;
            }
        })
        .filter((s): s is SessionMeta => s !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteSession(projectPath: string, sessionId: string): void {
    const file = sessionFile(projectPath, sessionId);
    if (fs.existsSync(file)) fs.rmSync(file);
}
