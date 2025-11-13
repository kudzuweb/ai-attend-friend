import { powerMonitor } from 'electron';
import type { SessionState, SessionInterruption, Reflection } from '../types/session.types.js';
import type { WindowManager } from './WindowManager.js';
import type { StorageService } from './StorageService.js';
import type { ScreenshotService } from './ScreenshotService.js';
import type { AIAnalysisService } from './AIAnalysisService.js';
import type { ConfigService } from './ConfigService.js';

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
            const recentFiles = await this.screenshotService.getRecentScreenshots(limit ?? 10);

            if (recentFiles.length === 0) {
                return { ok: false as const, error: 'no images' };
            }

            // Convert files to data URLs
            const dataUrls = await Promise.all(
                recentFiles.map(file => this.screenshotService.fileToDataUrl(file))
            );

            const res = await this.aiService.analyzeScreenshots(dataUrls, this.sessionState.focusGoal);

            if (res?.ok && res?.structured) {
                const status = res.structured.status;

                // Save analysis to current session if one is active
                if (this.currentSessionId && this.currentSessionDate) {
                    await this.storageService.addSummaryToSession(
                        this.currentSessionId,
                        this.currentSessionDate,
                        res.structured.analysis
                    );
                }

                if (status === 'distracted') {
                    this.windowManager.showPanel();
                    // Send analysis text to panel to trigger distraction reason view
                    this.windowManager.changeView({ view: 'distracted-reason', data: res.structured.analysis });
                } else if (status === 'focused') {
                    this.windowManager.hidePanel();
                }
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

        // Create session file and track session info
        try {
            this.currentSessionId = await this.storageService.createSession(startTime, lengthMs, focusGoal, tasks);
            this.currentSessionDate = this.storageService.formatDateFolder(new Date(startTime));
        } catch (e) {
            console.error('Error creating session:', e);
            return { ok: false, error: 'failed to create session file' };
        }

        this.broadcastSessionState();

        // Start the screenshot timer (note: actual capture happens in renderer)
        // The timer just tracks when captures should happen
        this.screenshotTimer = setTimeout(() => {
            if (!this.sessionState.isActive) return;

            // Continue with regular interval
            this.screenshotTimer = setInterval(() => {
                if (!this.sessionState.isActive) {
                    this.stopScreenshotTimer();
                }
            }, 30_000);
        }, 30_000);

        // Start the analysis timer (5 minutes if demo mode is OFF)
        this.startAnalysisTimer();

        // Schedule session end
        this.sessionTimer = setTimeout(async () => {
            await this.stopSession();
            // Reopen panel to show analysis
            this.windowManager.showPanel();
        }, lengthMs);

        return { ok: true };
    }

    /**
     * Generate final summary for the current session
     * Called before session ends to create AI-generated summary
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

        // CRITICAL: Stop all timers FIRST to prevent race conditions
        // Must happen before any async operations that modify session data
        this.stopSessionTimer();
        this.stopScreenshotTimer();
        this.stopAnalysisTimer();

        // Generate final summary after stopping timers
        await this.generateFinalSummary();

        this.sessionState.isActive = false;
        this.sessionState.lengthMs = 0;
        this.sessionState.startTime = 0;
        this.sessionState.endTime = 0;
        this.sessionState.focusGoal = '';

        // Clear current session tracking
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
     * Start the analysis timer (5 minutes) if demo mode is OFF
     */
    private startAnalysisTimer(): void {
        this.stopAnalysisTimer();

        // Only start if demo mode is OFF and session is active
        const demoMode = this.configService.getDemoMode();
        if (demoMode || !this.sessionState.isActive) {
            console.log('[SessionManager] Analysis timer NOT started - demoMode:', demoMode, 'isActive:', this.sessionState.isActive);
            return;
        }

        console.log('[SessionManager] Starting auto-analysis timer (5 minutes)');
        const intervalMs = 5 * 60 * 1000; // 5 minutes

        this.analysisTimer = setInterval(async () => {
            console.log('[SessionManager] Auto-analysis triggered');
            await this.handleDistractionAnalysis(10);
        }, intervalMs);
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
     * Called when settings like demoMode are updated during an active session
     */
    handleSettingsChange(): void {
        console.log('[SessionManager] Settings changed, re-evaluating analysis timer');
        // Re-evaluate whether analysis timer should be running
        // This will stop the timer if demoMode is now ON, or start it if demoMode is now OFF
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

        // Create interruption record
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
     * Returns true if successful, false if no active interruption
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
     * Returns true if successful, false if no active session
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
        // Resume the session timer with remaining time
        this.sessionTimer = setTimeout(async () => {
            await this.stopSession();
            this.windowManager.showPanel();
        }, this.remainingSessionTime);

        // Resume screenshot timer
        this.screenshotTimer = setInterval(() => {
            if (!this.sessionState.isActive) {
                this.stopScreenshotTimer();
            }
        }, 30_000);

        // Resume analysis timer
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

        // Adjust session end time by adding the sleep duration
        const interruptionDuration = this.currentInterruption.durationMs;
        this.sessionState.endTime += interruptionDuration;
        console.log('[SessionManager] Adjusted session end time by', interruptionDuration, 'ms');

        // Save interruption reflection
        if (!await this.saveInterruptionReflection(reflection)) {
            console.log('[SessionManager] Error: could not save interruption reflection');
            return { ok: false, error: 'no active interruption' };
        }

        // Resume timers
        this.resumeSessionTimers();

        // Hide panel
        this.windowManager.hidePanel();

        this.broadcastSessionState();
        return { ok: true };
    }

    /**
     * End session after interruption
     */
    async endAfterInterruption(reflection: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] endAfterInterruption called');

        // Save interruption reflection
        if (!await this.saveInterruptionReflection(reflection)) {
            console.log('[SessionManager] Error: no active interruption');
            return { ok: false, error: 'no active interruption' };
        }

        // End the session
        await this.stopSession();

        return { ok: true };
    }

    /**
     * Save reflection and resume session (called from deeper reflection view)
     */
    async saveReflectionAndResume(reflectionContent: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] saveReflectionAndResume called');

        if (!this.sessionState.isActive) {
            console.log('[SessionManager] Error: no active session');
            return { ok: false, error: 'no active session' };
        }

        // Save reflection to session
        await this.saveReflection(reflectionContent);

        // Resume timers
        this.resumeSessionTimers();

        // Hide panel
        this.windowManager.hidePanel();

        this.broadcastSessionState();
        return { ok: true };
    }

    /**
     * Save reflection and end session (called from deeper reflection view)
     */
    async saveReflectionAndEndSession(reflectionContent: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] saveReflectionAndEndSession called');

        if (!this.sessionState.isActive) {
            console.log('[SessionManager] Error: no active session');
            return { ok: false, error: 'no active session' };
        }

        // Save reflection to session
        await this.saveReflection(reflectionContent);

        // End the session
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

        // Record resume time
        const now = Date.now();
        this.currentInterruption.resumeTime = now;
        this.currentInterruption.durationMs = now - this.currentInterruption.suspendTime;
        console.log('[SessionManager] Interruption duration (ms):', this.currentInterruption.durationMs);

        // Show panel with reflection UI
        this.windowManager.showPanel();
        this.windowManager.changeView({ view: 'interruption-reflection' });
    }

    /**
     * Setup power monitoring for session interruptions
     */
    setupPowerMonitoring(): void {
        console.log('[SessionManager] Setting up power monitoring');

        // Listen for system suspend
        powerMonitor.on('suspend', () => {
            console.log('[PowerMonitor] suspend event');
            if (!this.sessionState.isActive) return;
            this.pauseSession();
        });

        powerMonitor.on('resume', () => {
            console.log('[PowerMonitor] resume event');
            this.handleSystemWake();
        });

        // macOS fires lock-screen when display sleeps
        powerMonitor.on('lock-screen', () => {
            console.log('[PowerMonitor] lock-screen event');
            if (!this.sessionState.isActive) return;
            this.pauseSession();
        });

        powerMonitor.on('unlock-screen', () => {
            console.log('[PowerMonitor] unlock-screen event');
            this.handleSystemWake();
        });

        console.log('[SessionManager] Power monitoring setup complete');
    }
}
