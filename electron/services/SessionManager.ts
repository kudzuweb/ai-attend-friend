import { powerMonitor } from 'electron';
import type { SessionState, SessionInterruption, Reflection } from '../types/session.types.js';
import type { WindowManager } from './WindowManager.js';
import type { StorageService } from './StorageService.js';
import type { ScreenshotService } from './ScreenshotService.js';

export class SessionManager {
    private sessionState: SessionState;
    private sessionTimer: NodeJS.Timeout | null = null;
    private screenshotTimer: NodeJS.Timeout | null = null;
    private currentSessionId: string | null = null;
    private currentSessionDate: string | null = null;
    private currentInterruption: SessionInterruption | null = null;
    private remainingSessionTime: number = 0;

    private windowManager: WindowManager;
    private storageService: StorageService;
    private screenshotService: ScreenshotService;

    constructor(
        windowManager: WindowManager,
        storageService: StorageService,
        screenshotService: ScreenshotService
    ) {
        this.windowManager = windowManager;
        this.storageService = storageService;
        this.screenshotService = screenshotService;

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
     * Broadcast session state to all windows
     */
    private broadcastSessionState(): void {
        this.windowManager.broadcastSessionState(this.sessionState);
    }

    /**
     * Start a new session
     */
    async startSession(lengthMs: number, focusGoal: string): Promise<{ ok: true } | { ok: false; error: string }> {
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

        // Create session file and track session info
        try {
            this.currentSessionId = await this.storageService.createSession(startTime, lengthMs, focusGoal);
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

        // Schedule session end
        this.sessionTimer = setTimeout(() => {
            this.stopSession();
            // Reopen panel to show analysis
            this.windowManager.showPanel();
        }, lengthMs);

        return { ok: true };
    }

    /**
     * Stop the current session
     */
    stopSession(): void {
        this.sessionState.isActive = false;
        this.sessionState.lengthMs = 0;
        this.sessionState.startTime = 0;
        this.sessionState.endTime = 0;
        this.sessionState.focusGoal = '';

        this.stopSessionTimer();
        this.stopScreenshotTimer();

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
     * Pause session (called when system sleeps)
     */
    pauseSession(): void {
        console.log('[SessionManager] Pausing session');
        const now = Date.now();
        this.remainingSessionTime = this.sessionState.endTime - now;
        console.log('[SessionManager] Remaining time (ms):', this.remainingSessionTime);

        this.stopSessionTimer();
        this.stopScreenshotTimer();

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
     * Resume session after interruption
     */
    async resumeAfterInterruption(reflection: string): Promise<{ ok: true } | { ok: false; error: string }> {
        console.log('[SessionManager] resumeAfterInterruption called');

        if (!this.sessionState.isActive || !this.currentInterruption) {
            console.log('[SessionManager] Error: no active interruption');
            return { ok: false, error: 'no active interruption' };
        }

        // Store user's reflection
        this.currentInterruption.userReflection = reflection;

        // Save interruption to session
        if (this.currentSessionId && this.currentSessionDate) {
            await this.storageService.addInterruptionToSession(
                this.currentSessionId,
                this.currentSessionDate,
                this.currentInterruption
            );
        }

        // Adjust session end time by adding the sleep duration
        this.sessionState.endTime += this.currentInterruption.durationMs;
        console.log('[SessionManager] Adjusted session end time by', this.currentInterruption.durationMs, 'ms');

        // Resume the session timer with remaining time
        this.sessionTimer = setTimeout(() => {
            this.stopSession();
            this.windowManager.showPanel();
        }, this.remainingSessionTime);

        // Resume screenshot timer
        this.screenshotTimer = setInterval(() => {
            if (!this.sessionState.isActive) {
                this.stopScreenshotTimer();
            }
        }, 30_000);

        // Clear interruption state
        this.currentInterruption = null;

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

        if (!this.sessionState.isActive || !this.currentInterruption) {
            return { ok: false, error: 'no active interruption' };
        }

        // Store user's reflection
        this.currentInterruption.userReflection = reflection;

        // Save interruption to session
        if (this.currentSessionId && this.currentSessionDate) {
            await this.storageService.addInterruptionToSession(
                this.currentSessionId,
                this.currentSessionDate,
                this.currentInterruption
            );
        }

        // Clear interruption state
        this.currentInterruption = null;

        // End the session
        this.stopSession();

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

        // Create reflection object
        const reflection: Reflection = {
            timestamp: Date.now(),
            content: reflectionContent,
        };

        // Save reflection to session
        if (this.currentSessionId && this.currentSessionDate) {
            await this.storageService.addReflectionToSession(
                this.currentSessionId,
                this.currentSessionDate,
                reflection
            );
        }

        // Resume the session timer with remaining time
        this.sessionTimer = setTimeout(() => {
            this.stopSession();
            this.windowManager.showPanel();
        }, this.remainingSessionTime);

        // Resume screenshot timer
        this.screenshotTimer = setInterval(() => {
            if (!this.sessionState.isActive) {
                this.stopScreenshotTimer();
            }
        }, 30_000);

        // Hide panel
        this.windowManager.hidePanel();

        this.broadcastSessionState();
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
        this.windowManager.sendToPanel('session:show-interruption-reflection');
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
