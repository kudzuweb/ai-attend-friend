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

export interface StoredSession {
    id: string;
    startTime: number;
    endTime: number;
    lengthMs: number;
    focusGoal: string;
    tasks?: [string, string, string];
    interruptions: SessionInterruption[];
    summaries: string[];
    finalSummary: string | null;
}

export interface AnalysisResult {
    status: 'focused' | 'distracted';
    analysis: string;
    suggested_prompt: string;
}
