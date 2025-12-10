import { powerMonitor } from 'electron';
import type { SessionState, SessionInterruption, Reflection } from '../types/session.types.js';
import type { WindowManager } from './WindowManager.js';
import type { StorageService } from './StorageService.js';
import type { ScreenshotService } from './ScreenshotService.js';
import type { AIAnalysisService } from './AIAnalysisService.js';
import type { ConfigService } from './ConfigService.js';
import { SCREENSHOT_INTERVAL_MS, AUTO_ANALYSIS_INTERVAL_MS, DEFAULT_RECENT_SCREENSHOTS_LIMIT } from '../constants.js';

export class SessionManager {
    private sessionState: SessionState;
    private sessionTimer: NodeJS.Timeout | null = null;
    private screenshotTimer: NodeJS.Timeout | null = null;
    private analysisTimer: NodeJS.Timeout | null = null;
    private currentSessionId: string | null = null;
    private currentSessionDate: string | null = null;
    private currentInterruption: SessionInterruption | null = null;
    private remainingSessionTime: number = 0;

    private windowManager: WindowManager;
    private storageService: StorageService;
    private screenshotService: ScreenshotService;
    private aiService: AIAnalysisService;
    private configService: ConfigService;

    constructor(
        windowManager: WindowManager,
        storageService: StorageService,
        screenshotService: ScreenshotService,
        aiService: AIAnalysisService,
        configService: ConfigService
    ) {
        this.windowManager = windowManager;
        this.storageService = storageService;
        this.screenshotService = screenshotService;
        this.aiService = aiService;
        this.configService = configService;

        this.sessionState = {
            isActive: false,
            lengthMs: 0,
            startTime: 0,
            endTime: 0,
            focusGoal: '',
        };
    }

    /**
     * Get current session state
     */
    getSessionState(): SessionState {
        return { ...this.sessionState };
    }

    /**
     * Get current session ID and date
     */
    getCurrentSession(): { id: string | null; date: string | null } {
        return {
            id: this.currentSessionId,
            date: this.currentSessionDate
        };
    }

    /**
     * Get current interruption if any
     */
    getCurrentInterruption(): SessionInterruption | null {
        return this.currentInterruption;
    }

    /**
     * Handle distraction analysis from recent screenshots
     */
    async handleDistractionAnalysis(limit?: number): Promise<{
        ok: true;
        structured: {
            status: 'focused' | 'distracted';
            analysis: string;
            suggested_prompt: string;
        };
        raw?: unknown;
        count: number
    } | { ok: false; error: string }> {
        try {
            const recentFiles = await this.screenshotService.getRecentScreenshots(limit ?? DEFAULT_RECENT_SCREENSHOTS_LIMIT);

            if (recentFiles.length === 0) {
                return { ok: false as const, error: 'no images' };
            }

            const dataUrls = await Promise.all(
                recentFiles.map(file => this.screenshotService.fileToDataUrl(file))
            );

            const res = await this.aiService.analyzeScreenshots(dataUrls, this.sessionState.focusGoal);

            if (res?.ok && res?.structured) {
                if (this.currentSessionId && this.currentSessionDate) {
                    await this.storageService.addSummaryToSession(
                        this.currentSessionId,
                        this.currentSessionDate,
                        res.structured.analysis
                    );
                }

                // TODO: Handle distraction UI in new architecture
                // For now, just log the status
                console.log('[SessionManager] Distraction analysis:', res.structured.status);
            }
            return res;
        } catch (e: any) {
            return { ok: false as const, error: e?.message ?? 'distraction analysis failed' };
        }
    }

    /**
     * Broadcast session state to all windows
     */
    private broadcastSessionState(): void {
        this.windowManager.broadcastSessionState(this.sessionState);
    }

    /**
     * Start a new session
     */
    async startSession(lengthMs: number, focusGoal: string, tasks?: [string, string, string]): Promise<{ ok: true } | { ok: false; error: string }> {
        if (this.sessionState.isActive) {
            return { ok: false, error: 'session already active' };
        }

        const startTime = Date.now();
        const endTime = startTime + lengthMs;

        this.sessionState.isActive = true;
        this.sessionState.lengthMs = lengthMs;
        this.sessionState.startTime = startTime;
        this.sessionState.endTime = endTime;
        this.sessionState.focusGoal = focusGoal;
        if (tasks) {
            this.sessionState.tasks = tasks;
        }

        try {
            this.currentSessionId = await this.storageService.createSession(startTime, lengthMs, focusGoal, tasks);
            this.currentSessionDate = this.storageService.formatDateFolder(new Date(startTime));
        } catch (e) {
            console.error('Error creating session:', e);
            return { ok: false, error: 'failed to create session file' };
        }

        this.broadcastSessionState();

        // Start the screenshot timer
        this.screenshotTimer = setTimeout(() => {
            if (!this.sessionState.isActive) return;

            this.screenshotTimer = setInterval(() => {
                if (!this.sessionState.isActive) {
                    this.stopScreenshotTimer();
                    return;
                }
                this.windowManager.triggerScreenshotCapture();
            }, SCREENSHOT_INTERVAL_MS);
        }, SCREENSHOT_INTERVAL_MS);

        // Start the analysis timer
        this.startAnalysisTimer();

        // Schedule session end
        this.sessionTimer = setTimeout(async () => {
            await this.stopSession();
        }, lengthMs);

        return { ok: true };
    }

    /**
     * Generate final summary for the current session
     */
    private async generateFinalSummary(): Promise<void> {
        if (!this.currentSessionId || !this.currentSessionDate) {
            return;
        }

        try {
            const session = await this.storageService.loadSession(
                this.currentSessionId,
                this.currentSessionDate
            );

            if (session && session.summaries.length > 0) {
                const finalSummary = await this.aiService.generateFinalSummary(
                    session.summaries,
                    session.interruptions || [],
                    session.distractions || [],
                    session.reflections || [],
                    session.focusGoal || ''
                );

                if (finalSummary) {
                    await this.storageService.setFinalSummary(
                        this.currentSessionId,
                        this.currentSessionDate,
                        finalSummary
                    );
                }
            }
        } catch (e) {
            console.error('[SessionManager] Error generating final summary:', e);
        }
    }

    /**
     * Stop the current session
     */
    async stopSession(): Promise<void> {
        console.log('[SessionManager] stopSession called');

        this.stopSessionTimer();
        this.stopScreenshotTimer();
        this.stopAnalysisTimer();

        await this.generateFinalSummary();

        this.sessionState.isActive = false;
        this.sessionState.lengthMs = 0;
        this.sessionState.startTime = 0;
        this.sessionState.endTime = 0;
        this.sessionState.focusGoal = '';

        this.currentSessionId = null;
        this.currentSessionDate = null;

        this.broadcastSessionState();
    }

    /**
     * Stop session timer
     */
    private stopSessionTimer(): void {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }
    }

    /**
     * Stop screenshot timer
     */
    private stopScreenshotTimer(): void {
        if (this.screenshotTimer) {
            clearTimeout(this.screenshotTimer);
            clearInterval(this.screenshotTimer);
            this.screenshotTimer = null;
        }
    }

    /**
     * Start the analysis timer if demo mode is OFF
     */
    private startAnalysisTimer(): void {
        this.stopAnalysisTimer();

        const demoMode = this.configService.getDemoMode();
        if (demoMode || !this.sessionState.isActive) {
            console.log('[SessionManager] Analysis timer NOT started - demoMode:', demoMode, 'isActive:', this.sessionState.isActive);
            return;
        }

        console.log('[SessionManager] Starting auto-analysis timer (5 minutes)');

        this.analysisTimer = setInterval(async () => {
            console.log('[SessionManager] Auto-analysis triggered');
            await this.handleDistractionAnalysis(DEFAULT_RECENT_SCREENSHOTS_LIMIT);
        }, AUTO_ANALYSIS_INTERVAL_MS);
    }

    /**
     * Stop the analysis timer
     */
    private stopAnalysisTimer(): void {
        if (this.analysisTimer) {
            clearInterval(this.analysisTimer);
            this.analysisTimer = null;
        }
    }

    /**
     * Handle settings change - re-evaluate analysis timer state
     */
    handleSettingsChange(): void {
        console.log('[SessionManager] Settings changed, re-evaluating analysis timer');
        this.startAnalysisTimer();
    }

    /**
     * Pause session (called when system sleeps)
     */
    pauseSession(): void {
        console.log('[SessionManager] Pausing session');
        const now = Date.now();
        this.remainingSessionTime = this.sessionState.endTime - now;
        console.log('[SessionManager] Remaining time (ms):', this.remainingSessionTime);

        this.stopSessionTimer();
        this.stopScreenshotTimer();
        this.stopAnalysisTimer();

        this.currentInterruption = {
            suspendTime: now,
            resumeTime: null,
            durationMs: 0,
            userReflection: null,
        };
        console.log('[SessionManager] Interruption record created:', this.currentInterruption);
    }

    /**
     * Save interruption reflection to session
     */
    private async saveInterruptionReflection(reflection: string): Promise<boolean> {
        if (!this.sessionState.isActive || !this.currentInterruption) {
            return false;
        }

        this.currentInterruption.userReflection = reflection;

        if (this.currentSessionId && this.currentSessionDate) {
            await this.storageService.addInterruptionToSession(
                this.currentSessionId,
                this.currentSessionDate,
                this.currentInterruption
            );
        }

        this.currentInterruption = null;
        return true;
    }

    /**
     * Save reflection to current session
     */
    private async saveReflection(content: string): Promise<boolean> {
        if (!this.sessionState.isActive) {
            return false;
        }

        const reflection: Reflection = {
            timestamp: Date.now(),
            content: content,
        };

        if (this.currentSessionId && this.currentSessionDate) {
            await this.storageService.addReflectionToSession(
                this.currentSessionId,
                this.currentSessionDate,
                reflection
            );
        }

        return true;
    }

    /**
     * Resume session and screenshot timers
     */
    private resumeSessionTimers(): void {
        this.sessionTimer = setTimeout(async () => {
            await this.stopSession();
        }, this.remainingSessionTime);

        this.screenshotTimer = setInterval(() => {
            if (!this.sessionState.isActive) {
                this.stopScreenshotTimer();
                return;
            }
            this.windowManager.triggerScreenshotCapture();
        }, SCREENSHOT_INTERVAL_MS);

        this.startAnalysisTimer();
    }

    /**
     * Resume session after interruption
     */
    async resumeAfterInterruption(reflection: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] resumeAfterInterruption called');

        if (!this.currentInterruption) {
            console.log('[SessionManager] Error: no active interruption');
            return { ok: false, error: 'no active interruption' };
        }

        const interruptionDuration = this.currentInterruption.durationMs;
        this.sessionState.endTime += interruptionDuration;
        console.log('[SessionManager] Adjusted session end time by', interruptionDuration, 'ms');

        if (!await this.saveInterruptionReflection(reflection)) {
            console.log('[SessionManager] Error: could not save interruption reflection');
            return { ok: false, error: 'no active interruption' };
        }

        this.resumeSessionTimers();
        this.broadcastSessionState();
        return { ok: true };
    }

    /**
     * End session after interruption
     */
    async endAfterInterruption(reflection: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] endAfterInterruption called');

        if (!await this.saveInterruptionReflection(reflection)) {
            console.log('[SessionManager] Error: no active interruption');
            return { ok: false, error: 'no active interruption' };
        }

        await this.stopSession();
        return { ok: true };
    }

    /**
     * Save reflection and resume session
     */
    async saveReflectionAndResume(reflectionContent: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] saveReflectionAndResume called');

        if (!this.sessionState.isActive) {
            console.log('[SessionManager] Error: no active session');
            return { ok: false, error: 'no active session' };
        }

        await this.saveReflection(reflectionContent);
        this.resumeSessionTimers();
        this.broadcastSessionState();
        return { ok: true };
    }

    /**
     * Save reflection and end session
     */
    async saveReflectionAndEndSession(reflectionContent: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] saveReflectionAndEndSession called');

        if (!this.sessionState.isActive) {
            console.log('[SessionManager] Error: no active session');
            return { ok: false, error: 'no active session' };
        }

        await this.saveReflection(reflectionContent);
        await this.stopSession();
        return { ok: true };
    }

    /**
     * Handle system wake event
     */
    handleSystemWake(): void {
        console.log('[SessionManager] handleSystemWake');

        if (!this.sessionState.isActive || !this.currentInterruption) {
            console.log('[SessionManager] No active session or interruption, ignoring wake');
            return;
        }

        const now = Date.now();
        this.currentInterruption.resumeTime = now;
        this.currentInterruption.durationMs = now - this.currentInterruption.suspendTime;
        console.log('[SessionManager] Interruption duration (ms):', this.currentInterruption.durationMs);

        // Auto-resume session after system wake
        // TODO: Add interruption reflection UI in new architecture to prompt user
        const durationMinutes = Math.round(this.currentInterruption.durationMs / 60000);
        this.resumeAfterInterruption(`[Auto-resumed after ${durationMinutes} minute pause]`);
        console.log('[SessionManager] Session auto-resumed after system wake');
    }

    /**
     * Setup power monitoring for session interruptions
     */
    setupPowerMonitoring(): void {
        console.log('[SessionManager] Setting up power monitoring');

        const safeLog = (msg: string) => {
            if (!process.stdout.writable) return;
            try { console.log(msg); } catch { /* ignore EPIPE */ }
        };

        powerMonitor.on('suspend', () => {
            safeLog('[PowerMonitor] suspend event');
            if (!this.sessionState.isActive) return;
            this.pauseSession();
        });

        powerMonitor.on('resume', () => {
            safeLog('[PowerMonitor] resume event');
            this.handleSystemWake();
        });

        powerMonitor.on('lock-screen', () => {
            safeLog('[PowerMonitor] lock-screen event');
            if (!this.sessionState.isActive) return;
            this.pauseSession();
        });

        powerMonitor.on('unlock-screen', () => {
            safeLog('[PowerMonitor] unlock-screen event');
            this.handleSystemWake();
        });

        console.log('[SessionManager] Power monitoring setup complete');
    }
}
