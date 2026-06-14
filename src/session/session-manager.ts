import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';


export interface Message {
    role: 'user' | 'agent';
    content: string;
}

export interface SessionData {
    id: string;
    updatedAt: string;
    messages: Message[];
}

function getProjectHash(): string {
    const cwd = process.cwd();
    return crypto.createHash('sha256').update(cwd).digest('hex').substring(0, 12);
}

async function getProjectStorageDir(): Promise<string> {
    const homeDir = os.homedir();
    const projectHash = getProjectHash();
    const storageDir = path.join(homeDir, '.ingenium', projectHash);

    await fs.mkdir(storageDir, { recursive: true });
    return storageDir;
}

export async function listSessions(): Promise<{ id: string; updatedAt: Date }[]> {
    const storageDir = await getProjectStorageDir();
    const files = await fs.readdir(storageDir);
    
    const sessions = [];
    for (const file of files) {
        if (file.endsWith('.json')) {
            const filePath = path.join(storageDir, file);
            const stats = await fs.stat(filePath);
            sessions.push({
                id: file.replace('.json', ''),
                updatedAt: stats.mtime
            });
        }
    }
    
    return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function loadSession(sessionId: string): Promise<SessionData | null> {
    const storageDir = await getProjectStorageDir();
    const filePath = path.join(storageDir, `${sessionId}.json`);

    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as SessionData;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null; 
        }
        throw error;
    }
}

export async function saveSession(sessionId: string, messages: Message[]): Promise<void> {
    const storageDir = await getProjectStorageDir();
    const filePath = path.join(storageDir, `${sessionId}.json`);

    const sessionData: SessionData = {
        id: sessionId,
        updatedAt: new Date().toISOString(),
        messages,
    };

    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
}