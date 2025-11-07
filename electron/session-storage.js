import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Session storage utilities for managing LLM analysis summaries grouped by date.
 * Sessions are organized in: {userData}/sessions/{YYYY-MM-DD}/{sessionId}.json
 */

/**
 * Get the base sessions directory
 */
function getBaseSessionsDir() {
    return path.join(app.getPath('userData'), 'sessions');
}

/**
 * Convert a Date object to YYYY-MM-DD format string
 */
export function formatDateFolder(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get the sessions directory for a specific date
 */
export function getSessionsDirForDate(date) {
    return path.join(getBaseSessionsDir(), formatDateFolder(date));
}

/**
 * Ensure the sessions directory exists for a given date
 */
async function ensureSessionsDir(date) {
    const dir = getSessionsDirForDate(date);
    await fs.mkdir(dir, { recursive: true });
}

/**
 * Create a new session file with initial data
 */
export async function createSession(startTime, lengthMs, focusGoal = '') {
    const date = new Date(startTime);
    await ensureSessionsDir(date);

    const sessionId = String(startTime);
    const sessionPath = path.join(getSessionsDirForDate(date), `${sessionId}.json`);

    const sessionData = {
        id: sessionId,
        startTime,
        endTime: startTime + lengthMs,
        lengthMs,
        focusGoal,
        interruptions: [],
        distractions: [],
        reflections: [],
        summaries: [],
        finalSummary: null,
    };

    await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
    return sessionId;
}

/**
 * Load a session from disk
 */
export async function loadSession(sessionId, dateFolder) {
    const sessionPath = path.join(getBaseSessionsDir(), dateFolder, `${sessionId}.json`);

    try {
        const data = await fs.readFile(sessionPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

/**
 * Add a summary to an existing session
 */
export async function addSummaryToSession(sessionId, dateFolder, summary) {
    try {
        const session = await loadSession(sessionId, dateFolder);
        if (!session) return false;

        session.summaries.push(summary);

        const sessionPath = path.join(getBaseSessionsDir(), dateFolder, `${sessionId}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error adding summary to session:', e);
        return false;
    }
}

/**
 * Add an interruption to an existing session
 */
export async function addInterruptionToSession(sessionId, dateFolder, interruption) {
    try {
        const session = await loadSession(sessionId, dateFolder);
        if (!session) return false;

        // Ensure interruptions array exists (for backwards compatibility)
        if (!session.interruptions) {
            session.interruptions = [];
        }

        session.interruptions.push(interruption);

        const sessionPath = path.join(getBaseSessionsDir(), dateFolder, `${sessionId}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error adding interruption to session:', e);
        return false;
    }
}

/**
 * Add a distraction reason to an existing session
 */
export async function addDistractionToSession(sessionId, dateFolder, distraction) {
    try {
        const session = await loadSession(sessionId, dateFolder);
        if (!session) return false;

        // Ensure distractions array exists (for backwards compatibility)
        if (!session.distractions) {
            session.distractions = [];
        }

        session.distractions.push(distraction);

        const sessionPath = path.join(getBaseSessionsDir(), dateFolder, `${sessionId}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error adding distraction to session:', e);
        return false;
    }
}

/**
 * Add a reflection to an existing session
 */
export async function addReflectionToSession(sessionId, dateFolder, reflection) {
    try {
        const session = await loadSession(sessionId, dateFolder);
        if (!session) return false;

        // Ensure reflections array exists (for backwards compatibility)
        if (!session.reflections) {
            session.reflections = [];
        }

        session.reflections.push(reflection);

        const sessionPath = path.join(getBaseSessionsDir(), dateFolder, `${sessionId}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error adding reflection to session:', e);
        return false;
    }
}

/**
 * Set the final summary for a session
 */
export async function setFinalSummary(sessionId, dateFolder, finalSummary) {
    try {
        const session = await loadSession(sessionId, dateFolder);
        if (!session) return false;

        session.finalSummary = finalSummary;

        const sessionPath = path.join(getBaseSessionsDir(), dateFolder, `${sessionId}.json`);
        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Error setting final summary:', e);
        return false;
    }
}

/**
 * List all sessions for a specific date
 */
export async function listSessionsByDate(dateFolder) {
    const dirPath = path.join(getBaseSessionsDir(), dateFolder);

    try {
        const files = await fs.readdir(dirPath);
        const sessions = [];

        for (const file of files) {
            if (file.endsWith('.json')) {
                const sessionId = file.replace('.json', '');
                const session = await loadSession(sessionId, dateFolder);
                if (session) {
                    sessions.push(session);
                }
            }
        }

        // Sort by startTime ascending (chronological order)
        sessions.sort((a, b) => a.startTime - b.startTime);
        return sessions;
    } catch (e) {
        // Directory doesn't exist yet
        return [];
    }
}

/**
 * List all sessions grouped by date
 */
export async function listAllSessions() {
    const baseDir = getBaseSessionsDir();

    try {
        const dateFolders = await fs.readdir(baseDir);
        const result = {};

        for (const dateFolder of dateFolders) {
            const folderPath = path.join(baseDir, dateFolder);
            const stat = await fs.stat(folderPath);

            // Only process directories
            if (stat.isDirectory()) {
                const sessions = await listSessionsByDate(dateFolder);
                if (sessions.length > 0) {
                    result[dateFolder] = sessions;
                }
            }
        }

        return result;
    } catch (e) {
        // Base directory doesn't exist yet
        return {};
    }
}

/**
 * Delete a session file
 */
export async function deleteSession(sessionId, dateFolder) {
    try {
        const sessionPath = path.join(getBaseSessionsDir(), dateFolder, `${sessionId}.json`);
        await fs.unlink(sessionPath);
        return true;
    } catch (e) {
        console.error('Error deleting session:', e);
        return false;
    }
}
