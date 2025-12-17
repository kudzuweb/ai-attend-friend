import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { JournalEntry } from '../types/session.types.js';

export class JournalStorage {
    private entriesPath: string;

    constructor() {
        this.entriesPath = path.join(app.getPath('userData'), 'journal', 'entries.json');
    }

    async init(): Promise<void> {
        await fs.mkdir(path.dirname(this.entriesPath), { recursive: true });

        try {
            await fs.access(this.entriesPath);
        } catch {
            await this.saveEntries([]);
        }
    }

    private async loadEntries(): Promise<JournalEntry[]> {
        const data = await fs.readFile(this.entriesPath, 'utf-8');
        return JSON.parse(data);
    }

    private async saveEntries(entries: JournalEntry[]): Promise<void> {
        await fs.writeFile(this.entriesPath, JSON.stringify(entries, null, 2), 'utf-8');
    }

    async getAllEntries(filterSessionId?: string): Promise<JournalEntry[]> {
        const entries = await this.loadEntries();

        if (filterSessionId === 'sessions-only') {
            return entries.filter(e => e.sessionId !== null);
        }

        if (filterSessionId) {
            return entries.filter(e => e.sessionId === filterSessionId);
        }

        return entries;
    }

    async createEntry(payload: {
        content: string;
        sessionId?: string | null;
        sourceLoopId?: string | null;
    }): Promise<JournalEntry> {
        const entries = await this.loadEntries();

        const newEntry: JournalEntry = {
            id: `journal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: payload.content,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            sessionId: payload.sessionId ?? null,
            sourceLoopId: payload.sourceLoopId ?? null,
            tags: [],
        };

        entries.push(newEntry);
        await this.saveEntries(entries);

        return newEntry;
    }

    async updateEntry(entryId: string, payload: { content: string }): Promise<{ ok: boolean }> {
        const entries = await this.loadEntries();
        const entry = entries.find(e => e.id === entryId);

        if (!entry) {
            return { ok: false };
        }

        entry.content = payload.content;
        entry.updatedAt = Date.now();

        await this.saveEntries(entries);
        return { ok: true };
    }

    async deleteEntry(entryId: string): Promise<{ ok: boolean }> {
        const entries = await this.loadEntries();
        const filtered = entries.filter(e => e.id !== entryId);

        if (filtered.length === entries.length) {
            return { ok: false };
        }

        await this.saveEntries(filtered);
        return { ok: true };
    }
}
