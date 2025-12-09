import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Task } from '../types/session.types.js';

export class TaskStorage {
    private tasksPath: string;

    constructor() {
        this.tasksPath = path.join(app.getPath('userData'), 'tasks', 'tasks.json');
    }

    async init(): Promise<void> {
        await fs.mkdir(path.dirname(this.tasksPath), { recursive: true });

        // Create empty file if doesn't exist
        try {
            await fs.access(this.tasksPath);
        } catch {
            await this.saveTasks([]);
        }
    }

    private async loadTasks(): Promise<Task[]> {
        const data = await fs.readFile(this.tasksPath, 'utf-8');
        return JSON.parse(data);
    }

    private async saveTasks(tasks: Task[]): Promise<void> {
        await fs.writeFile(this.tasksPath, JSON.stringify(tasks, null, 2), 'utf-8');
    }

    async getAllTasks(includeDeleted = false): Promise<Task[]> {
        const tasks = await this.loadTasks();
        return includeDeleted ? tasks : tasks.filter(t => !t.isDeleted);
    }

    async getTaskById(id: string): Promise<Task | null> {
        const tasks = await this.loadTasks();
        return tasks.find(t => t.id === id) ?? null;
    }

    async getTasksByIds(ids: string[]): Promise<Task[]> {
        const tasks = await this.loadTasks();
        return tasks.filter(t => ids.includes(t.id) && !t.isDeleted);
    }

    async getActiveTasksForSetup(): Promise<Task[]> {
        const tasks = await this.loadTasks();
        return tasks.filter(t =>
            !t.isCompleted &&
            !t.archivedAt &&
            !t.isDeleted &&
            !t.parentTaskId // Only top-level tasks
        );
    }

    async createTask(payload: {
        content: string;
        parentTaskId: string | null;
        sourceLoopId?: string;
    }): Promise<Task> {
        const tasks = await this.loadTasks();

        const newTask: Task = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: payload.content,
            createdAt: Date.now(),
            completedAt: null,
            archivedAt: null,
            deletedAt: null,
            isCompleted: false,
            isDeleted: false,
            sourceLoopId: payload.sourceLoopId ?? null,
            sessionIds: [],
            parentTaskId: payload.parentTaskId,
            subtaskIds: [],
        };

        tasks.push(newTask);

        // If this is a subtask, add to parent's subtaskIds
        if (payload.parentTaskId) {
            const parent = tasks.find(t => t.id === payload.parentTaskId);
            if (parent && !parent.subtaskIds.includes(newTask.id)) {
                parent.subtaskIds.push(newTask.id);
            }
        }

        await this.saveTasks(tasks);
        return newTask;
    }

    async toggleComplete(taskId: string): Promise<{ ok: boolean }> {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            return { ok: false };
        }

        task.isCompleted = !task.isCompleted;
        task.completedAt = task.isCompleted ? Date.now() : null;

        await this.saveTasks(tasks);

        // If this is a subtask, check if parent should auto-complete
        if (task.parentTaskId) {
            await this.recalculateParentCompletion(task.parentTaskId);
        }

        return { ok: true };
    }

    async recalculateParentCompletion(parentId: string): Promise<void> {
        const tasks = await this.loadTasks();
        const parent = tasks.find(t => t.id === parentId);

        if (!parent) return;

        const subtasks = tasks.filter(t =>
            parent.subtaskIds.includes(t.id) &&
            !t.isDeleted
        );

        const allComplete = subtasks.length > 0 && subtasks.every(st => st.isCompleted);

        if (allComplete && !parent.isCompleted) {
            parent.isCompleted = true;
            parent.completedAt = Date.now();
            await this.saveTasks(tasks);
        }
    }

    async deleteTask(taskId: string): Promise<{ ok: boolean }> {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            return { ok: false };
        }

        const now = Date.now();

        // Mark task as deleted
        task.isDeleted = true;
        task.deletedAt = now;

        // Cascade to subtasks
        const subtaskIds = [...task.subtaskIds];
        for (const subtaskId of subtaskIds) {
            const subtask = tasks.find(t => t.id === subtaskId);
            if (subtask) {
                subtask.isDeleted = true;
                subtask.deletedAt = now;
            }
        }

        await this.saveTasks(tasks);
        return { ok: true };
    }

    async restoreTask(taskId: string): Promise<{ ok: boolean }> {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            return { ok: false };
        }

        task.isDeleted = false;
        task.deletedAt = null;

        // Restore subtasks
        const subtaskIds = [...task.subtaskIds];
        for (const subtaskId of subtaskIds) {
            const subtask = tasks.find(t => t.id === subtaskId);
            if (subtask) {
                subtask.isDeleted = false;
                subtask.deletedAt = null;
            }
        }

        await this.saveTasks(tasks);
        return { ok: true };
    }

    async addSessionToTask(taskId: string, sessionId: string): Promise<void> {
        const tasks = await this.loadTasks();
        const task = tasks.find(t => t.id === taskId);

        if (task && !task.sessionIds.includes(sessionId)) {
            task.sessionIds.push(sessionId);
            await this.saveTasks(tasks);
        }
    }

    async archiveCompletedTasks(): Promise<number> {
        const tasks = await this.loadTasks();
        const now = Date.now();
        let count = 0;

        for (const task of tasks) {
            if (task.isCompleted && !task.archivedAt && !task.isDeleted) {
                task.archivedAt = now;
                count++;
            }
        }

        await this.saveTasks(tasks);
        return count;
    }

    async hardDeleteExpiredTasks(retentionMs: number): Promise<number> {
        const tasks = await this.loadTasks();
        const cutoff = Date.now() - retentionMs;

        const remainingTasks = tasks.filter(t => {
            // Keep if not deleted, or if deleted but within retention period
            return !t.isDeleted || !t.deletedAt || t.deletedAt > cutoff;
        });

        const deletedCount = tasks.length - remainingTasks.length;

        if (deletedCount > 0) {
            await this.saveTasks(remainingTasks);
        }

        return deletedCount;
    }
}
