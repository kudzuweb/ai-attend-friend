import type { SessionInterruption, StoredSession } from '../types/session.types.js';
import * as sessionStorage from '../session-storage.js';

/**
 * Service for managing session data persistence
 * Wraps the existing session-storage module for better encapsulation
 */
export class StorageService {
    /**
     * Create a new session file
     */
    async createSession(startTime: number, lengthMs: number, focusGoal: string = '', tasks?: [string, string, string]): Promise<string> {
        return await (sessionStorage as any).createSession(startTime, lengthMs, focusGoal, tasks);
    }

    /**
     * Load a session from disk
     */
    async loadSession(sessionId: string, dateFolder: string): Promise<StoredSession | null> {
        return await sessionStorage.loadSession(sessionId, dateFolder);
    }

    /**
     * Add an analysis summary to a session
     */
    async addSummaryToSession(sessionId: string, dateFolder: string, summary: string): Promise<boolean> {
        return await sessionStorage.addSummaryToSession(sessionId, dateFolder, summary);
    }

    /**
     * Add an interruption record to a session
     */
    async addInterruptionToSession(
        sessionId: string,
        dateFolder: string,
        interruption: SessionInterruption
    ): Promise<boolean> {
        return await sessionStorage.addInterruptionToSession(sessionId, dateFolder, interruption);
    }

    /**
     * Set the final summary for a session
     */
    async setFinalSummary(sessionId: string, dateFolder: string, finalSummary: string): Promise<boolean> {
        return await sessionStorage.setFinalSummary(sessionId, dateFolder, finalSummary);
    }

    /**
     * List all sessions for a specific date
     */
    async listSessionsByDate(dateFolder: string): Promise<StoredSession[]> {
        return await sessionStorage.listSessionsByDate(dateFolder);
    }

    /**
     * List all sessions grouped by date
     */
    async listAllSessions(): Promise<Record<string, StoredSession[]>> {
        return await sessionStorage.listAllSessions();
    }

    /**
     * Delete a session file
     */
    async deleteSession(sessionId: string, dateFolder: string): Promise<boolean> {
        return await sessionStorage.deleteSession(sessionId, dateFolder);
    }

    /**
     * Format a date as YYYY-MM-DD for folder naming
     */
    formatDateFolder(date: Date): string {
        return sessionStorage.formatDateFolder(date);
    }
}
