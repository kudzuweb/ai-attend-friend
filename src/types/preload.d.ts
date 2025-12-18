export { };

declare global {
    // screenshot type
    type Screenshot = { dataUrl: string; capturedAt: string };

    // Task type
    type Task = {
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
    };

    // Open Loop type
    type OpenLoop = {
        id: string;
        content: string;
        createdAt: number;
        completedAt: number | null;
        archivedAt: number | null;
        isActive: boolean;
    };

    // Journal Entry type
    type JournalEntry = {
        id: string;
        content: string;
        createdAt: number;
        updatedAt: number;
        sessionId: string | null;
        sourceLoopId: string | null;
        tags: string[];
    };

    // session interruption when system sleeps
    type SessionInterruption = {
        suspendTime: number;
        resumeTime: number | null;
        durationMs: number;
        userReflection: string | null;
    };

    // distraction reason during session
    type DistractionReason = {
        timestamp: number;
        userReason: string;
    };

    // deeper reflection during session
    type Reflection = {
        timestamp: number;
        content: string;
    };

    // Session task type (subset of Task for widget display)
    type SessionTask = {
        id: string;
        content: string;
        isCompleted: boolean;
    };

    // session state type
    type SessionState = {
        isActive: boolean;
        isPaused?: boolean;
        suspendTime?: number;
        lengthMs: number;
        startTime: number;
        endTime: number;
        focusGoal: string;
        tasks?: SessionTask[];
    };

    // stored session with summaries grouped by date
    type StoredSession = {
        id: string;
        startTime: number;
        endTime: number;
        lengthMs: number;
        focusGoal: string;
        tasks?: SessionTask[];
        interruptions: SessionInterruption[];
        distractions: DistractionReason[];
        reflections: Reflection[];
        summaries: string[];
        finalSummary: string | null;
    };

    // add window.api to Window type so TS doesn't freak out
    interface Window {
        api: {
            getScreenPermissionStatus: () => Promise<
                'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown'
            >;
            openScreenRecordingSettings: () => Promise<{ ok: boolean; reason?: string }>;
            relaunchApp: () => Promise<void>;
            captureFrames: () => Promise<{ dataUrl: string; capturedAt: string }>;
            saveImage: (payload: { dataUrl: string; capturedAt: string }) => Promise<
                | { ok: true; file: string; deduped: boolean; bytes: number }
                | { ok: false; error: string }
            >;
            getRecentImages(limit?: number): Promise<{ ok: true; files?: string[] } | { ok: false; error: string }>;
            analyzeRecent(limit?: number): Promise<{
                ok: true;
                structured: {
                    status: 'focused' | 'distracted';
                };
                raw?: unknown;
                count: number
            } | { ok: false; error: string }>;
            getSettings: () => Promise<{ windowPosition: 'top-left' | 'top-center' | 'top-right'; demoMode: boolean; tasksEnabled: boolean }>;
            updateSettings: (partial: { demoMode?: boolean; tasksEnabled?: boolean }) => Promise<{ windowPosition: 'top-left' | 'top-center' | 'top-right'; demoMode: boolean; tasksEnabled: boolean }>;
            sessionStart: (lengthMs: number, focusGoal: string, tasks?: SessionTask[]) => Promise<{ ok: true } | { ok: false; error: string }>;
            sessionGetState: () => Promise<SessionState>;
            sessionStop: () => Promise<{ ok: true } | { ok: false; error: string }>;
            sessionListByDate: (date: string) => Promise<{ ok: true; sessions: StoredSession[] } | { ok: false; error: string }>;
            sessionListAll: () => Promise<{ ok: true; sessions: Record<string, StoredSession[]> } | { ok: false; error: string }>;
            sessionGet: (sessionId: string, date: string) => Promise<{ ok: true; session: StoredSession } | { ok: false; error: string }>;
            onSessionUpdated: (callback: (state: SessionState) => void) => () => void;
            onInterruption: (callback: (data: { durationMs: number }) => void) => () => void;
            onDistraction: (callback: () => void) => () => void;
            handleInterruption: (action: 'resume' | 'end', reflection: string) => Promise<{ ok: true } | { ok: false; error: string }>;
            handleReflection: (action: 'resume' | 'end', reflection: string) => Promise<{ ok: true } | { ok: false; error: string }>;
            saveDistractionReason: (reason: string) => Promise<{ ok: true } | { ok: false; error: string }>;
            pauseSession: () => Promise<void>;
            resumeSession: () => Promise<void>;
            pauseSessionForStuck: () => Promise<void>;
            resumeAfterStuck: (reflection: string, pauseDurationMs: number) => Promise<{ ok: true } | { ok: false; error: string }>;
            endAfterStuck: (reflection: string) => Promise<{ ok: true } | { ok: false; error: string }>;
            quitApp: () => Promise<void>;
            // Task APIs
            getTasks: () => Promise<{ ok: true; tasks: Task[] } | { ok: false; error: string }>;
            getTaskById: (taskId: string) => Promise<{ ok: true; task: Task } | { ok: false; error: string }>;
            getActiveTasksForSetup: () => Promise<{ ok: true; tasks: Task[] } | { ok: false; error: string }>;
            createTask: (payload: {
                content: string;
                parentTaskId: string | null;
                sourceLoopId?: string;
            }) => Promise<{ ok: true; task: Task } | { ok: false; error: string }>;
            toggleTaskComplete: (taskId: string) => Promise<{ ok: boolean; isCompleted?: boolean }>;
            onTaskUpdated: (callback: (taskId: string) => void) => () => void;
            updateTask: (taskId: string, payload: { content: string }) => Promise<{ ok: boolean }>;
            deleteTask: (taskId: string) => Promise<{ ok: boolean }>;
            restoreTask: (taskId: string) => Promise<{ ok: boolean }>;
            // Open Loop APIs
            getOpenLoops: (includeArchived?: boolean) => Promise<{ ok: true; loops: OpenLoop[] } | { ok: false; error: string }>;
            getActiveOpenLoops: () => Promise<{ ok: true; loops: OpenLoop[] } | { ok: false; error: string }>;
            getOpenLoopById: (loopId: string) => Promise<{ ok: true; loop: OpenLoop } | { ok: false; error: string }>;
            createOpenLoop: (payload: { content: string }) => Promise<{ ok: true; loop: OpenLoop } | { ok: false; error: string }>;
            toggleOpenLoopComplete: (loopId: string) => Promise<{ ok: boolean }>;
            archiveOpenLoop: (loopId: string) => Promise<{ ok: boolean }>;
            // Journal APIs
            getJournalEntries: (filterSessionId?: string) => Promise<{ ok: true; entries: JournalEntry[] } | { ok: false; error: string }>;
            createJournalEntry: (payload: {
                content: string;
                sessionId?: string | null;
                sourceLoopId?: string | null;
            }) => Promise<{ ok: true; entry: JournalEntry } | { ok: false; error: string }>;
            updateJournalEntry: (entryId: string, payload: { content: string }) => Promise<{ ok: boolean }>;
            deleteJournalEntry: (entryId: string) => Promise<{ ok: boolean }>;
            // Distraction reflection APIs
            saveDistractionReflection: (payload: {
                content: string;
                reasonType: string;
            }) => Promise<{ ok: true; entryId: string } | { ok: false; error: string }>;
            openReflectionEntry: (entryId: string) => Promise<{ ok: boolean }>;
            onNavigateToReflection: (callback: (entryId: string) => void) => () => void;
            // Window control APIs
            showSessionWidget: () => Promise<void>;
            hideSessionWidget: () => Promise<void>;
            minimizeMainWindow: () => Promise<void>;
            restoreMainWindow: () => Promise<void>;
            // Screenshot capture listener
            onScreenshotCapture: (callback: () => void) => () => void;
            // Report screenshot capture result to orchestrator
            reportScreenshotResult: (result: {
                ok: true; dataUrl: string; capturedAt: string
            } | {
                ok: false; error: string
            }) => Promise<void>;
        };
    }
    // media track constraints for chromium to allow more granular config
    interface MediaTrackConstraintSet {
        // Chromium-only bits used by Electron desktop capture
        chromeMediaSource?: 'desktop' | 'screen' | 'window' | 'tab';
        chromeMediaSourceId?: string;
        mandatory?: {
            chromeMediaSource?: 'desktop' | 'screen' | 'window' | 'tab';
            chromeMediaSourceId?: string;
            maxWidth?: number;
            maxHeight?: number;
            maxFrameRate?: number;
        };
    }
}
