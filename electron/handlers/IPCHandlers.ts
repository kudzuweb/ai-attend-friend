import { ipcMain, desktopCapturer, shell, systemPreferences, app } from 'electron';
import type { WindowManager } from '../services/WindowManager.js';
import type { SessionManager } from '../services/SessionManager.js';
import type { ScreenshotService } from '../services/ScreenshotService.js';
import type { AIAnalysisService } from '../services/AIAnalysisService.js';
import type { StorageService } from '../services/StorageService.js';
import type { ConfigService } from '../services/ConfigService.js';
import type { TaskStorage } from '../services/TaskStorage.js';
import type { OpenLoopStorage } from '../services/OpenLoopStorage.js';
import type { JournalStorage } from '../services/JournalStorage.js';

export function registerIPCHandlers(
    windowManager: WindowManager,
    sessionManager: SessionManager,
    screenshotService: ScreenshotService,
    aiService: AIAnalysisService,
    storageService: StorageService,
    configService: ConfigService,
    taskStorage: TaskStorage,
    openLoopStorage: OpenLoopStorage,
    journalStorage: JournalStorage
) {
    console.log('[IPCHandlers] Registering IPC handlers');

    // ========== Permission & System Handlers ==========

    ipcMain.handle('screen-permission-status', () => {
        return systemPreferences.getMediaAccessStatus('screen');
    });

    ipcMain.handle('open-screen-recording-settings', async () => {
        if (process.platform === 'darwin') {
            await shell.openExternal(
                'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
            );
            return { ok: true };
        }
        return { ok: false, reason: 'unsupported_platform' };
    });

    ipcMain.handle('relaunch-app', () => {
        app.relaunch({ args: process.argv.slice(1).concat(['--relaunch']) });
        app.exit(0);
    });

    ipcMain.handle('quit-app', () => {
        app.quit();
    });

    // ========== Screenshot Handlers ==========

    ipcMain.handle('desktopCapturer-get-sources', (_e, opts) => {
        return desktopCapturer.getSources(opts);
    });

    ipcMain.handle('save-image', async (_evt, payload: { dataUrl: string; capturedAt: string }) => {
        const { dataUrl, capturedAt } = payload;
        return await screenshotService.saveScreenshot(dataUrl, capturedAt);
    });

    ipcMain.handle('images:get-recent', async (_evt, limit?: number) => {
        try {
            return { ok: true as const, files: await screenshotService.getRecentScreenshots(limit ?? 10) };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'get recent image handler failed' };
        }
    });

    // ========== AI Analysis Handlers ==========

    ipcMain.handle('llm:send-recent', async (_evt, limit?: number) => {
        return await sessionManager.handleDistractionAnalysis(limit);
    });

    // ========== Panel Handlers ==========

    ipcMain.handle('panel:show', () => {
        windowManager.showPanel();
    });

    ipcMain.handle('panel:hide', () => {
        windowManager.hidePanel();
    });

    ipcMain.handle('window:set-position', (_evt, position: 'top-left' | 'top-center' | 'top-right') => {
        console.log('[IPCHandlers] window:set-position received:', position);
        windowManager.setWindowPosition(position);
    });

    ipcMain.handle('ui:request-session-setup', () => {
        console.log('[IPCHandlers] ui:request-session-setup received');
        windowManager.requestSessionSetup();
    });

    ipcMain.handle('ui:request-settings', () => {
        console.log('[IPCHandlers] ui:request-settings received');
        windowManager.requestSettings();
    });

    ipcMain.handle('ui:request-analysis', () => {
        console.log('[IPCHandlers] ui:request-analysis received');
        windowManager.requestAnalysis();
    });

    // ========== Window Control Handlers (New Architecture) ==========

    ipcMain.handle('window:show-session-widget', async () => {
        console.log('[IPCHandlers] window:show-session-widget received');
        await windowManager.showSessionWidget();
    });

    ipcMain.handle('window:hide-session-widget', () => {
        console.log('[IPCHandlers] window:hide-session-widget received');
        windowManager.hideSessionWidget();
    });

    ipcMain.handle('window:minimize-main', () => {
        console.log('[IPCHandlers] window:minimize-main received');
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
            mainWindow.minimize();
        }
    });

    ipcMain.handle('window:restore-main', () => {
        console.log('[IPCHandlers] window:restore-main received');
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
            mainWindow.restore();
            mainWindow.focus();
        }
    });

    // ========== Settings Handlers ==========

    ipcMain.handle('settings:get', () => {
        return configService.getAllSettings();
    });

    ipcMain.handle('settings:update', (_evt, partial: { demoMode?: boolean; tasksEnabled?: boolean }) => {
        const result = configService.updateSettings(partial);
        // Notify SessionManager that settings changed so it can re-evaluate timers
        sessionManager.handleSettingsChange();
        return result;
    });

    // Feature flag handlers
    ipcMain.handle('config:getUseNewArchitecture', () => {
        return configService.getUseNewArchitecture();
    });

    ipcMain.handle('config:setUseNewArchitecture', (_evt, enabled: boolean) => {
        configService.setUseNewArchitecture(enabled);
        return { ok: true };
    });

    // ========== Session Handlers ==========

    ipcMain.handle('session:start', async (_evt, lengthMs: number, focusGoal: string, tasks?: [string, string, string]) => {
        const result = await sessionManager.startSession(lengthMs, focusGoal, tasks);

        // If session started successfully and tasks are provided, show tasks view
        if (result.ok && tasks && tasks.some(t => t.trim())) {
            windowManager.showTasksView();
        }

        return result;
    });

    ipcMain.handle('session:get-state', () => {
        return sessionManager.getSessionState();
    });

    ipcMain.handle('session:stop', async () => {
        // Clean up session screenshots asynchronously (non-blocking)
        // TODO: Re-enable after debugging
        // const sessionState = sessionManager.getSessionState();
        // void screenshotService.deleteSessionScreenshots(sessionState.startTime, sessionState.endTime);

        await sessionManager.stopSession();
        return { ok: true as const };
    });

    // ========== Interruption Handlers ==========

    ipcMain.handle('session:handle-interruption', async (_evt, payload: { action: 'resume' | 'end', reflection: string }) => {
        console.log('[IPCHandlers] session:handle-interruption called with action:', payload.action);
        if (payload.action === 'resume') {
            return await sessionManager.resumeAfterInterruption(payload.reflection);
        } else {
            return await sessionManager.endAfterInterruption(payload.reflection);
        }
    });

    // ========== Reflection Handlers ==========

    ipcMain.handle('session:pause', () => {
        console.log('[IPCHandlers] session:pause called');
        sessionManager.pauseSession();
    });

    ipcMain.handle('session:handle-reflection', async (_evt, payload: { action: 'resume' | 'end', reflection: string }) => {
        console.log('[IPCHandlers] session:handle-reflection called with action:', payload.action);
        if (payload.action === 'resume') {
            return await sessionManager.saveReflectionAndResume(payload.reflection);
        } else {
            return await sessionManager.saveReflectionAndEndSession(payload.reflection);
        }
    });

    // ========== Distraction Handlers ==========

    ipcMain.handle('session:save-distraction-reason', async (_evt, reason: string) => {
        console.log('[IPCHandlers] session:save-distraction-reason called');
        try {
            const { id: sessionId, date: sessionDate } = sessionManager.getCurrentSession();
            if (!sessionId || !sessionDate) {
                return { ok: false as const, error: 'no active session' };
            }

            const distraction = {
                timestamp: Date.now(),
                userReason: reason,
            };

            const success = await storageService.addDistractionToSession(sessionId, sessionDate, distraction);
            if (success) {
                return { ok: true as const };
            } else {
                return { ok: false as const, error: 'failed to save distraction' };
            }
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'unknown error' };
        }
    });

    // ========== Session Retrieval Handlers ==========

    ipcMain.handle('session:list-by-date', async (_evt, dateString: string) => {
        try {
            const sessions = await storageService.listSessionsByDate(dateString);
            return { ok: true as const, sessions };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to list sessions by date' };
        }
    });

    ipcMain.handle('session:list-all', async () => {
        try {
            const sessions = await storageService.listAllSessions();
            return { ok: true as const, sessions };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to list all sessions' };
        }
    });

    ipcMain.handle('session:get', async (_evt, sessionId: string, dateString: string) => {
        try {
            const session = await storageService.loadSession(sessionId, dateString);
            if (!session) {
                return { ok: false as const, error: 'session not found' };
            }
            return { ok: true as const, session };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get session' };
        }
    });

    // ========== Task Handlers ==========

    ipcMain.handle('task:getAll', async () => {
        try {
            const tasks = await taskStorage.getAllTasks();
            return { ok: true as const, tasks };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get tasks' };
        }
    });

    ipcMain.handle('task:getById', async (_evt, taskId: string) => {
        try {
            const task = await taskStorage.getTaskById(taskId);
            if (!task) {
                return { ok: false as const, error: 'task not found' };
            }
            return { ok: true as const, task };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get task' };
        }
    });

    ipcMain.handle('task:getActiveForSetup', async () => {
        try {
            const tasks = await taskStorage.getActiveTasksForSetup();
            return { ok: true as const, tasks };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get active tasks' };
        }
    });

    ipcMain.handle('task:create', async (_evt, payload: {
        content: string;
        parentTaskId: string | null;
        sourceLoopId?: string;
    }) => {
        try {
            const task = await taskStorage.createTask(payload);
            return { ok: true as const, task };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to create task' };
        }
    });

    ipcMain.handle('task:toggleComplete', async (_evt, taskId: string) => {
        try {
            const result = await taskStorage.toggleComplete(taskId);
            return result;
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to toggle task completion' };
        }
    });

    ipcMain.handle('task:delete', async (_evt, taskId: string) => {
        try {
            const task = await taskStorage.getTaskById(taskId);
            if (!task) {
                return { ok: false as const, error: 'task not found' };
            }

            const result = await taskStorage.deleteTask(taskId);

            // If task had a parent, recalculate parent completion
            if (result.ok && task.parentTaskId) {
                await taskStorage.recalculateParentCompletion(task.parentTaskId);
            }

            return result;
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to delete task' };
        }
    });

    ipcMain.handle('task:restore', async (_evt, taskId: string) => {
        try {
            return await taskStorage.restoreTask(taskId);
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to restore task' };
        }
    });

    // ========== Open Loop Handlers ==========

    ipcMain.handle('openloop:getAll', async (_evt, includeArchived = false) => {
        try {
            const loops = await openLoopStorage.getAllLoops(includeArchived);
            return { ok: true as const, loops };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get open loops' };
        }
    });

    ipcMain.handle('openloop:getActive', async () => {
        try {
            const loops = await openLoopStorage.getActiveLoops();
            return { ok: true as const, loops };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get active loops' };
        }
    });

    ipcMain.handle('openloop:getById', async (_evt, loopId: string) => {
        try {
            const loop = await openLoopStorage.getLoopById(loopId);
            if (!loop) {
                return { ok: false as const, error: 'loop not found' };
            }
            return { ok: true as const, loop };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get loop' };
        }
    });

    ipcMain.handle('openloop:create', async (_evt, payload: { content: string }) => {
        try {
            const loop = await openLoopStorage.createLoop(payload);
            return { ok: true as const, loop };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to create loop' };
        }
    });

    ipcMain.handle('openloop:toggleComplete', async (_evt, loopId: string) => {
        try {
            return await openLoopStorage.toggleComplete(loopId);
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to toggle loop completion' };
        }
    });

    ipcMain.handle('openloop:archive', async (_evt, loopId: string) => {
        try {
            return await openLoopStorage.archiveLoop(loopId);
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to archive loop' };
        }
    });

    // ========== Journal Handlers ==========

    ipcMain.handle('journal:getAll', async (_evt, filterSessionId?: string) => {
        try {
            const entries = await journalStorage.getAllEntries(filterSessionId);
            return { ok: true as const, entries };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to get journal entries' };
        }
    });

    ipcMain.handle('journal:create', async (_evt, payload: {
        content: string;
        sessionId?: string | null;
    }) => {
        try {
            const entry = await journalStorage.createEntry(payload);
            return { ok: true as const, entry };
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to create journal entry' };
        }
    });

    ipcMain.handle('journal:update', async (_evt, entryId: string, payload: { content: string }) => {
        try {
            return await journalStorage.updateEntry(entryId, payload);
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to update journal entry' };
        }
    });

    ipcMain.handle('journal:delete', async (_evt, entryId: string) => {
        try {
            return await journalStorage.deleteEntry(entryId);
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'failed to delete journal entry' };
        }
    });

    console.log('[IPCHandlers] All IPC handlers registered');
}
