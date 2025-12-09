/**
 * Shared type definitions for session management
 */

export interface SessionState {
    isActive: boolean;
    lengthMs: number;
    startTime: number;
    endTime: number;
    focusGoal: string;
    tasks?: [string, string, string];
}

export interface SessionInterruption {
    suspendTime: number;
    resumeTime: number | null;
    durationMs: number;
    userReflection: string | null;
}

export interface DistractionReason {
    timestamp: number;
    userReason: string;
}

export interface Reflection {
    timestamp: number;
    content: string;
}

export interface StoredSession {
    id: string;
    startTime: number;
    endTime: number;
    lengthMs: number;
    focusGoal: string;
    tasks?: [string, string, string];
    interruptions: SessionInterruption[];
    distractions: DistractionReason[];
    reflections: Reflection[];
    summaries: string[];
    finalSummary: string | null;
}

export interface AnalysisResult {
    status: 'focused' | 'distracted';
    analysis: string;
    suggested_prompt: string;
}

/**
 * New architecture types (for refactor)
 */

export interface Task {
    id: string;
    content: string;
    createdAt: number;
    completedAt: number | null;
    archivedAt: number | null;
    deletedAt: number | null;
    isCompleted: boolean;
    isDeleted: boolean;
    sourceLoopId: string | null;
    sessionIds: string[];
    parentTaskId: string | null;
    subtaskIds: string[];
}

export interface OpenLoop {
    id: string;
    content: string;
    createdAt: number;
    completedAt: number | null;
    archivedAt: number | null;
    isActive: boolean;
}

export interface JournalEntry {
    id: string;
    content: string;
    createdAt: number;
    updatedAt: number;
    sessionId: string | null;
    tags: string[];
}

export type CompletedTaskVisibility = 'immediate' | 'end-of-session' | 'end-of-day';
export type DeletedTaskRetention = '1day' | '7days' | '30days';
