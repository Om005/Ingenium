import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import * as schema from "@db/schema.js";

const INGENIUM_DIR = path.join(homedir(), ".ingenium");
const DB_PATH = path.join(INGENIUM_DIR, "ingenium.db");

function ensureDir(): void {
    fs.mkdirSync(INGENIUM_DIR, { recursive: true });
}

let sqlite: Database.Database | null = null;
let db: ReturnType<typeof drizzle> | null = null;

function getRawSqlite(): Database.Database {
    if (sqlite) return sqlite;
    ensureDir();
    sqlite = new Database(DB_PATH);
    sqlite.pragma("journal_mode = WAL");
    return sqlite;
}

export function getDb() {
    if (db) return db;
    const raw = getRawSqlite();
    db = drizzle(raw, { schema });
    return db;
}

export function initDb(): void {
    const raw = getRawSqlite();

    raw.exec(`
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            message TEXT NOT NULL,
            trigger_at INTEGER NOT NULL,
            fired INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            deliver_via TEXT NOT NULL DEFAULT 'desktop'
        );
    `);
}

export function closeDb(): void {
    sqlite?.close();
    sqlite = null;
    db = null;
}

export { DB_PATH };
