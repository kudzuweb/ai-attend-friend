import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { OpenLoop } from '../types/session.types.js';

export class OpenLoopStorage {
    private loopsPath: string;

    constructor() {
        this.loopsPath = path.join(app.getPath('userData'), 'openloops', 'openloops.json');
    }

    async init(): Promise<void> {
        await fs.mkdir(path.dirname(this.loopsPath), { recursive: true });

        try {
            await fs.access(this.loopsPath);
        } catch {
            await this.saveLoops([]);
        }
    }

    private async loadLoops(): Promise<OpenLoop[]> {
        const data = await fs.readFile(this.loopsPath, 'utf-8');
        return JSON.parse(data);
    }

    private async saveLoops(loops: OpenLoop[]): Promise<void> {
        await fs.writeFile(this.loopsPath, JSON.stringify(loops, null, 2), 'utf-8');
    }

    async getAllLoops(includeArchived = false): Promise<OpenLoop[]> {
        const loops = await this.loadLoops();
        return includeArchived ? loops : loops.filter(l => !l.archivedAt);
    }

    async getActiveLoops(): Promise<OpenLoop[]> {
        const loops = await this.loadLoops();
        return loops.filter(l => l.isActive && !l.completedAt && !l.archivedAt);
    }

    async getLoopById(id: string): Promise<OpenLoop | null> {
        const loops = await this.loadLoops();
        return loops.find(l => l.id === id) ?? null;
    }

    async createLoop(payload: { content: string }): Promise<OpenLoop> {
        const loops = await this.loadLoops();

        const newLoop: OpenLoop = {
            id: `loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: payload.content,
            createdAt: Date.now(),
            completedAt: null,
            archivedAt: null,
            isActive: true,
        };

        loops.push(newLoop);
        await this.saveLoops(loops);

        return newLoop;
    }

    async toggleComplete(loopId: string): Promise<{ ok: boolean }> {
        const loops = await this.loadLoops();
        const loop = loops.find(l => l.id === loopId);

        if (!loop) {
            return { ok: false };
        }

        loop.completedAt = loop.completedAt ? null : Date.now();
        loop.isActive = !loop.completedAt;

        await this.saveLoops(loops);
        return { ok: true };
    }

    async archiveLoop(loopId: string): Promise<{ ok: boolean }> {
        const loops = await this.loadLoops();
        const loop = loops.find(l => l.id === loopId);

        if (!loop) {
            return { ok: false };
        }

        loop.archivedAt = Date.now();
        loop.isActive = false;

        await this.saveLoops(loops);
        return { ok: true };
    }

    async updateLoop(loopId: string, updates: { content: string }): Promise<{ ok: boolean }> {
        const loops = await this.loadLoops();
        const loop = loops.find(l => l.id === loopId);

        if (!loop) {
            return { ok: false };
        }

        loop.content = updates.content;

        await this.saveLoops(loops);
        return { ok: true };
    }
}
