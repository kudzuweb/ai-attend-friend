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
        try {
            const recentFiles = await screenshotService.getRecentScreenshots(limit ?? 10);

            if (recentFiles.length === 0) {
                return { ok: false as const, error: 'no images' };
            }

            // Convert files to data URLs
            const dataUrls = await Promise.all(
                recentFiles.map(file => screenshotService.fileToDataUrl(file))
            );

            const sessionState = sessionManager.getSessionState();
            const res = await aiService.analyzeScreenshots(dataUrls, sessionState.focusGoal);

            if (res?.ok && res?.structured) {
                const status = res.structured.status;

                // Save analysis to current session if one is active
                const { id: sessionId, date: sessionDate } = sessionManager.getCurrentSession();
                if (sessionId && sessionDate) {
                    await storageService.addSummaryToSession(sessionId, sessionDate, res.structured.analysis);
                }

                if (status === 'distracted') {
                    windowManager.showPanel();
                    // Send analysis text to panel to trigger distraction reason view
                    windowManager.sendToPanel('session:show-distraction-reason', res.structured.analysis);
                } else if (status === 'focused') {
                    windowManager.hidePanel();
                }
            }
            return res;
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'send recent image handler failed' };
        }
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

    // ========== Session Handlers ==========

    ipcMain.handle('session:start', async (_evt, lengthMs: number, focusGoal: string) => {
        return await sessionManager.startSession(lengthMs, focusGoal);
    });

    ipcMain.handle('session:get-state', () => {
        return sessionManager.getSessionState();
    });

    ipcMain.handle('session:stop', async () => {
        // Generate final summary before clearing session
        const { id: sessionId, date: sessionDate } = sessionManager.getCurrentSession();
        if (sessionId && sessionDate) {
            try {
                const session = await storageService.loadSession(sessionId, sessionDate);
                if (session && session.summaries.length > 0) {
                    const finalSummary = await aiService.generateFinalSummary(
                        session.summaries,
                        session.interruptions || [],
                        session.distractions || [],
                        session.reflections || [],
                        session.focusGoal || ''
                    );
                    if (finalSummary) {
                        await storageService.setFinalSummary(sessionId, sessionDate, finalSummary);
                    }
                }
            } catch (e) {
                console.error('Error generating final summary:', e);
            }
        }

        // Clean up session screenshots asynchronously (non-blocking)
        // TODO: Re-enable after debugging
        // const sessionState = sessionManager.getSessionState();
        // void screenshotService.deleteSessionScreenshots(sessionState.startTime, sessionState.endTime);

        sessionManager.stopSession();
        return { ok: true as const };
    });

    // ========== Interruption Handlers ==========

    ipcMain.handle('session:resume-after-interruption', async (_evt, reflection: string) => {
        console.log('[IPCHandlers] session:resume-after-interruption called');
        return await sessionManager.resumeAfterInterruption(reflection);
    });

    ipcMain.handle('session:end-after-interruption', async (_evt, reflection: string) => {
        console.log('[IPCHandlers] session:end-after-interruption called');
        return await sessionManager.endAfterInterruption(reflection);
    });

    // ========== Reflection Handlers ==========

    ipcMain.handle('session:pause', () => {
        console.log('[IPCHandlers] session:pause called');
        sessionManager.pauseSession();
    });

    ipcMain.handle('session:save-reflection-and-resume', async (_evt, reflection: string) => {
        console.log('[IPCHandlers] session:save-reflection-and-resume called');
        return await sessionManager.saveReflectionAndResume(reflection);
    });

    ipcMain.handle('session:save-reflection-and-end-session', async (_evt, reflection: string) => {
        console.log('[IPCHandlers] session:save-reflection-and-end-session called');
        return await sessionManager.saveReflectionAndEndSession(reflection);
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
