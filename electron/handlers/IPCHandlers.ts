import { ipcMain, desktopCapturer, shell, systemPreferences, app } from 'electron';
import type { WindowManager } from '../services/WindowManager.js';
import type { SessionManager } from '../services/SessionManager.js';
import type { ScreenshotService } from '../services/ScreenshotService.js';
import type { AIAnalysisService } from '../services/AIAnalysisService.js';
import type { StorageService } from '../services/StorageService.js';

export function registerIPCHandlers(
    windowManager: WindowManager,
    sessionManager: SessionManager,
    screenshotService: ScreenshotService,
    aiService: AIAnalysisService,
    storageService: StorageService
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

    ipcMain.handle('ui:request-session-setup', () => {
        console.log('[IPCHandlers] ui:request-session-setup received');
        windowManager.requestSessionSetup();
    });

    ipcMain.handle('ui:request-settings', () => {
        console.log('[IPCHandlers] ui:request-settings received');
        windowManager.requestSettings();
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

    console.log('[IPCHandlers] All IPC handlers registered');
}
