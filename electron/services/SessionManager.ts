import { powerMonitor } from 'electron';
import type { SessionState, SessionInterruption, Reflection } from '../types/session.types.js';
import type { WindowManager } from './WindowManager.js';
import type { StorageService } from './StorageService.js';
import type { ScreenshotService } from './ScreenshotService.js';
import type { AIAnalysisService } from './AIAnalysisService.js';
import type { ConfigService } from './ConfigService.js';
import type { CaptureOrchestrator } from './CaptureOrchestrator.js';
import { AUTO_ANALYSIS_INTERVAL_MS, DEFAULT_RECENT_SCREENSHOTS_LIMIT } from '../constants.js';

// Session phase discriminated union - replaces multiple boolean flags
type SessionPhase =
    | { phase: 'idle' }
    | {
        phase: 'active';
        sessionId: string;
        sessionDate: string;
        endTime: number;
        focusGoal: string;
        tasks?: [string, string, string];
    }
    | {
        phase: 'paused';
        sessionId: string;
        sessionDate: string;
        endTime: number;
        focusGoal: string;
        tasks?: [string, string, string];
        pauseType: 'system' | 'user';
        suspendTime: number;
    }
    | {
        phase: 'awaiting_reflection';
        sessionId: string;
        sessionDate: string;
        endTime: number;
        focusGoal: string;
        tasks?: [string, string, string];
        pauseType: 'system' | 'user';
        suspendTime: number;
        wakeTime: number;
        durationMs: number;
    }
    | {
        phase: 'stopping';
        sessionId: string;
        sessionDate: string;
    };

export class SessionManager {
    // State machine - single source of truth for session state
    private sessionPhase: SessionPhase = { phase: 'idle' };
    private lengthMs: number = 0;  // Original session length (for UI)
    private startTime: number = 0; // Session start time (for UI)

    // Timer refs
    private sessionTimer: NodeJS.Timeout | null = null;
    private analysisTimer: NodeJS.Timeout | null = null;
    private operationQueue: Promise<void> = Promise.resolve();

    private windowManager: WindowManager;
    private storageService: StorageService;
    private screenshotService: ScreenshotService;
    private aiService: AIAnalysisService;
    private configService: ConfigService;
    private captureOrchestrator: CaptureOrchestrator;

    constructor(
        windowManager: WindowManager,
        storageService: StorageService,
        screenshotService: ScreenshotService,
        aiService: AIAnalysisService,
        configService: ConfigService,
        captureOrchestrator: CaptureOrchestrator
    ) {
        this.windowManager = windowManager;
        this.storageService = storageService;
        this.screenshotService = screenshotService;
        this.aiService = aiService;
        this.configService = configService;
        this.captureOrchestrator = captureOrchestrator;
        // sessionPhase is initialized to { phase: 'idle' } in the field declaration
    }

    /**
     * Enqueue an operation to run sequentially, preventing race conditions
     */
    private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.operationQueue.then(operation);
        // Swallow errors to keep chain going, errors propagate via result
        this.operationQueue = result.then(() => {}, () => {});
        return result;
    }

    /**
     * Transition to a new session phase - single point of state change
     */
    private transitionTo(newPhase: SessionPhase): void {
        const oldPhase = this.sessionPhase.phase;
        console.log(`[SessionManager] Phase transition: ${oldPhase} → ${newPhase.phase}`);
        this.sessionPhase = newPhase;
        this.broadcastSessionState();
    }

    /**
     * Get current session state (backward-compatible with SessionState interface)
     */
    getSessionState(): SessionState {
        const phase = this.sessionPhase;

        if (phase.phase === 'idle') {
            return { isActive: false, lengthMs: 0, startTime: 0, endTime: 0, focusGoal: '' };
        }

        if (phase.phase === 'stopping') {
            return { isActive: false, lengthMs: this.lengthMs, startTime: this.startTime, endTime: 0, focusGoal: '' };
        }

        // active, paused, or awaiting_reflection - session is "active" from UI perspective
        return {
            isActive: true,
            lengthMs: this.lengthMs,
            startTime: this.startTime,
            endTime: phase.endTime,
            focusGoal: phase.focusGoal,
            tasks: phase.tasks,
        };
    }

    /**
     * Get current session ID and date (derived from phase)
     */
    getCurrentSession(): { id: string | null; date: string | null } {
        const phase = this.sessionPhase;
        if (phase.phase === 'idle') {
            return { id: null, date: null };
        }
        return {
            id: phase.sessionId,
            date: phase.sessionDate
        };
    }

    /**
     * Get current interruption if any (derived from phase)
     */
    getCurrentInterruption(): SessionInterruption | null {
        const phase = this.sessionPhase;
        if (phase.phase === 'paused' || phase.phase === 'awaiting_reflection') {
            return {
                suspendTime: phase.suspendTime,
                resumeTime: phase.phase === 'awaiting_reflection' ? phase.wakeTime : null,
                durationMs: phase.phase === 'awaiting_reflection' ? phase.durationMs : 0,
                userReflection: null,
            };
        }
        return null;
    }

    /**
     * Handle distraction analysis from recent screenshots
     */
    async handleDistractionAnalysis(limit?: number): Promise<{
        ok: true;
        structured: {
            status: 'focused' | 'distracted';
        };
        raw?: unknown;
        count: number
    } | { ok: false; error: string }> {
        try {
            const phase = this.sessionPhase;

            // Get focus goal and tasks from phase if active/paused/awaiting_reflection
            const focusGoal = phase.phase !== 'idle' && phase.phase !== 'stopping'
                ? phase.focusGoal
                : '';
            const tasks = phase.phase !== 'idle' && phase.phase !== 'stopping'
                ? phase.tasks
                : undefined;

            const recentFiles = await this.screenshotService.getRecentScreenshots(limit ?? DEFAULT_RECENT_SCREENSHOTS_LIMIT);

            if (recentFiles.length === 0) {
                return { ok: false as const, error: 'no images' };
            }

            const dataUrls = await Promise.all(
                recentFiles.map(file => this.screenshotService.fileToDataUrl(file))
            );

            const res = await this.aiService.analyzeScreenshots(dataUrls, focusGoal, tasks);

            if (res?.ok && res?.structured) {
                // Re-check phase after async call - session may have changed
                const currentPhase = this.sessionPhase;

                // Only broadcast distraction UI when actively working (not paused/awaiting)
                if (res.structured.status === 'distracted' && currentPhase.phase === 'active') {
                    console.log('[SessionManager] Distraction detected, broadcasting to UI');
                    this.windowManager.broadcastDistraction();
                } else if (res.structured.status === 'distracted') {
                    console.log('[SessionManager] Distraction detected but session paused/ended, not broadcasting');
                } else {
                    console.log('[SessionManager] User is focused');
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
        this.windowManager.broadcastSessionState(this.getSessionState());
    }

    /**
     * Start a new session
     */
    async startSession(lengthMs: number, focusGoal: string, tasks?: [string, string, string]): Promise<{ ok: true } | { ok: false; error: string }> {
        if (this.sessionPhase.phase !== 'idle') {
            return { ok: false, error: 'session already active' };
        }

        const startTime = Date.now();
        const endTime = startTime + lengthMs;

        // Store metadata for UI
        this.lengthMs = lengthMs;
        this.startTime = startTime;

        let sessionId: string;
        let sessionDate: string;

        try {
            sessionId = await this.storageService.createSession(startTime, lengthMs, focusGoal, tasks);
            sessionDate = this.storageService.formatDateFolder(new Date(startTime));
        } catch (e) {
            console.error('Error creating session:', e);
            return { ok: false, error: 'failed to create session file' };
        }

        // Transition to active phase
        this.transitionTo({
            phase: 'active',
            sessionId,
            sessionDate,
            endTime,
            focusGoal,
            tasks,
        });

        // Enable screenshot capture via orchestrator
        await this.captureOrchestrator.enable();

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
        const phase = this.sessionPhase;

        // Only generate summary if we have session info (stopping phase has sessionId/sessionDate)
        if (phase.phase !== 'stopping') {
            return;
        }

        try {
            const session = await this.storageService.loadSession(
                phase.sessionId,
                phase.sessionDate
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
                        phase.sessionId,
                        phase.sessionDate,
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

        const phase = this.sessionPhase;

        // Can stop from active, paused, or awaiting_reflection
        if (phase.phase === 'idle' || phase.phase === 'stopping') {
            console.log('[SessionManager] Already stopped or stopping');
            return;
        }

        this.stopSessionTimer();
        this.captureOrchestrator.disable();
        this.stopAnalysisTimer();

        // Transition to stopping phase (prevents concurrent operations)
        this.transitionTo({
            phase: 'stopping',
            sessionId: phase.sessionId,
            sessionDate: phase.sessionDate,
        });

        await this.generateFinalSummary();

        // Reset metadata and transition to idle
        this.lengthMs = 0;
        this.startTime = 0;
        this.transitionTo({ phase: 'idle' });
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
     * Start the analysis timer if demo mode is OFF
     */
    private startAnalysisTimer(): void {
        this.stopAnalysisTimer();

        const demoMode = this.configService.getDemoMode();
        const isActive = this.sessionPhase.phase === 'active';
        if (demoMode || !isActive) {
            console.log('[SessionManager] Analysis timer NOT started - demoMode:', demoMode, 'isActive:', isActive);
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
     * Pause session (called when system sleeps/locks)
     */
    pauseSession(): void {
        const suspendTime = Date.now(); // Capture timestamp synchronously at event time
        this.enqueueOperation(async () => {
            console.log('[SessionManager] Pausing session (system)');

            const phase = this.sessionPhase;

            // Only pause from active state
            if (phase.phase !== 'active') {
                // If already paused/awaiting, update suspend time for new sleep cycle
                if (phase.phase === 'paused' || phase.phase === 'awaiting_reflection') {
                    console.log('[SessionManager] Already paused, updating suspend time for additional away time');
                    // Create new phase with updated suspendTime (spread won't work due to type narrowing)
                    if (phase.phase === 'paused') {
                        this.transitionTo({ ...phase, suspendTime });
                    } else {
                        this.transitionTo({ ...phase, suspendTime });
                    }
                }
                return;
            }

            this.stopSessionTimer();
            this.captureOrchestrator.pause();
            this.stopAnalysisTimer();

            this.transitionTo({
                phase: 'paused',
                sessionId: phase.sessionId,
                sessionDate: phase.sessionDate,
                endTime: phase.endTime,
                focusGoal: phase.focusGoal,
                tasks: phase.tasks,
                pauseType: 'system',
                suspendTime,
            });
        });
    }

    /**
     * Pause session for user-initiated stuck flow
     */
    pauseSessionForStuck(): void {
        const suspendTime = Date.now();
        this.enqueueOperation(async () => {
            console.log('[SessionManager] Pausing session (stuck)');

            const phase = this.sessionPhase;

            // If already paused (e.g., user clicked Pause then Stuck), update to user pauseType
            if (phase.phase === 'paused') {
                console.log('[SessionManager] Already paused, updating to user pauseType for stuck flow');
                this.transitionTo({
                    ...phase,
                    pauseType: 'user',
                    suspendTime, // Reset suspend time for stuck timing
                });
                return;
            }

            if (phase.phase !== 'active') {
                console.log('[SessionManager] Cannot pause for stuck - not active or paused');
                return;
            }

            this.stopSessionTimer();
            this.captureOrchestrator.pause();
            this.stopAnalysisTimer();

            this.transitionTo({
                phase: 'paused',
                sessionId: phase.sessionId,
                sessionDate: phase.sessionDate,
                endTime: phase.endTime,
                focusGoal: phase.focusGoal,
                tasks: phase.tasks,
                pauseType: 'user',
                suspendTime,
            });
        });
    }

    /**
     * Save reflection to current session
     * Works from any phase that has session info (active, paused, awaiting_reflection)
     */
    private async saveReflection(content: string, sessionId: string, sessionDate: string): Promise<void> {
        const reflection: Reflection = {
            timestamp: Date.now(),
            content: content,
        };

        await this.storageService.addReflectionToSession(
            sessionId,
            sessionDate,
            reflection
        );
    }

    /**
     * Resume session and screenshot timers
     * @param remainingMs - time remaining in session (already calculated by caller)
     */
    private resumeSessionTimers(remainingMs: number): void {
        this.sessionTimer = setTimeout(async () => {
            await this.stopSession();
        }, remainingMs);

        // Resume screenshot capture via orchestrator
        this.captureOrchestrator.resume();

        this.startAnalysisTimer();
    }

    /**
     * Resume session after interruption (system wake)
     */
    async resumeAfterInterruption(reflection: string): Promise<{ ok: true } | { ok: false; error: string }> {
        return this.enqueueOperation(async () => {
            console.log('[SessionManager] resumeAfterInterruption called');

            const phase = this.sessionPhase;

            if (phase.phase !== 'awaiting_reflection') {
                console.log('[SessionManager] Error: not awaiting reflection');
                return { ok: false as const, error: 'not awaiting reflection' };
            }

            // Save interruption to storage
            await this.storageService.addInterruptionToSession(
                phase.sessionId,
                phase.sessionDate,
                {
                    suspendTime: phase.suspendTime,
                    resumeTime: phase.wakeTime,
                    durationMs: phase.durationMs,
                    userReflection: reflection,
                }
            );

            // Calculate new end time (extend by interruption duration)
            const newEndTime = phase.endTime + phase.durationMs;
            const remainingMs = Math.max(0, newEndTime - Date.now());
            console.log('[SessionManager] Adjusted session end time by', phase.durationMs, 'ms');

            // Transition back to active
            this.transitionTo({
                phase: 'active',
                sessionId: phase.sessionId,
                sessionDate: phase.sessionDate,
                endTime: newEndTime,
                focusGoal: phase.focusGoal,
                tasks: phase.tasks,
            });

            this.resumeSessionTimers(remainingMs);
            return { ok: true as const };
        });
    }

    /**
     * End session after interruption
     */
    async endAfterInterruption(reflection: string): Promise<{ ok: true } | { ok: false; error: string }> {
        return this.enqueueOperation(async () => {
            console.log('[SessionManager] endAfterInterruption called');

            const phase = this.sessionPhase;

            if (phase.phase !== 'awaiting_reflection') {
                console.log('[SessionManager] Error: not awaiting reflection');
                return { ok: false as const, error: 'not awaiting reflection' };
            }

            // Save interruption to storage
            await this.storageService.addInterruptionToSession(
                phase.sessionId,
                phase.sessionDate,
                {
                    suspendTime: phase.suspendTime,
                    resumeTime: phase.wakeTime,
                    durationMs: phase.durationMs,
                    userReflection: reflection,
                }
            );

            await this.stopSession();
            return { ok: true as const };
        });
    }

    /**
     * Resume session after user-initiated stuck flow
     * Unlike system interruptions, stuck flow passes duration from the renderer
     */
    async resumeAfterStuck(reflection: string, pauseDurationMs: number): Promise<{ ok: true } | { ok: false; error: string }> {
        return this.enqueueOperation(async () => {
            console.log('[SessionManager] resumeAfterStuck called with duration:', pauseDurationMs);

            const phase = this.sessionPhase;

            // Must be in paused state with pauseType='user'
            if (phase.phase !== 'paused' || phase.pauseType !== 'user') {
                console.log('[SessionManager] Error: not paused from stuck');
                return { ok: false as const, error: 'not paused from stuck' };
            }

            // Save as a proper reflection (not interruption)
            await this.saveReflection(reflection, phase.sessionId, phase.sessionDate);

            // Calculate new end time (extend by pause duration)
            const newEndTime = phase.endTime + pauseDurationMs;
            const remainingMs = Math.max(0, newEndTime - Date.now());
            console.log('[SessionManager] Extended session end time by', pauseDurationMs, 'ms');

            // Transition back to active
            this.transitionTo({
                phase: 'active',
                sessionId: phase.sessionId,
                sessionDate: phase.sessionDate,
                endTime: newEndTime,
                focusGoal: phase.focusGoal,
                tasks: phase.tasks,
            });

            this.resumeSessionTimers(remainingMs);
            return { ok: true as const };
        });
    }

    /**
     * End session after user-initiated stuck flow, saving reflection first
     */
    async endAfterStuck(reflection: string): Promise<{ ok: true } | { ok: false; error: string }> {
        return this.enqueueOperation(async () => {
            console.log('[SessionManager] endAfterStuck called');

            const phase = this.sessionPhase;

            // Must be in paused state with pauseType='user'
            if (phase.phase !== 'paused' || phase.pauseType !== 'user') {
                console.log('[SessionManager] Error: not paused from stuck');
                return { ok: false as const, error: 'not paused from stuck' };
            }

            // Save reflection before ending
            await this.saveReflection(reflection, phase.sessionId, phase.sessionDate);

            await this.stopSession();
            return { ok: true as const };
        });
    }

    /**
     * Save reflection and resume session (generic flow)
     */
    async saveReflectionAndResume(reflectionContent: string): Promise<{ ok: true } | { ok: false; error: string }> {
        return this.enqueueOperation(async () => {
            console.log('[SessionManager] saveReflectionAndResume called');

            const phase = this.sessionPhase;

            // Need to be in a pausable state (paused or awaiting_reflection)
            if (phase.phase !== 'paused' && phase.phase !== 'awaiting_reflection') {
                console.log('[SessionManager] Error: no paused session');
                return { ok: false as const, error: 'no paused session' };
            }

            await this.saveReflection(reflectionContent, phase.sessionId, phase.sessionDate);

            const remainingMs = Math.max(0, phase.endTime - Date.now());

            // Transition back to active
            this.transitionTo({
                phase: 'active',
                sessionId: phase.sessionId,
                sessionDate: phase.sessionDate,
                endTime: phase.endTime,
                focusGoal: phase.focusGoal,
                tasks: phase.tasks,
            });

            this.resumeSessionTimers(remainingMs);
            return { ok: true as const };
        });
    }

    /**
     * Save reflection and end session (generic flow)
     */
    async saveReflectionAndEndSession(reflectionContent: string): Promise<{ ok: true } | { ok: false; error: string }> {
        return this.enqueueOperation(async () => {
            console.log('[SessionManager] saveReflectionAndEndSession called');

            const phase = this.sessionPhase;

            // Need session info to save reflection
            if (phase.phase === 'idle' || phase.phase === 'stopping') {
                console.log('[SessionManager] Error: no active session');
                return { ok: false as const, error: 'no active session' };
            }

            await this.saveReflection(reflectionContent, phase.sessionId, phase.sessionDate);
            await this.stopSession();
            return { ok: true as const };
        });
    }

    /**
     * Handle system wake event
     * Transitions from 'paused' (pauseType='system') to 'awaiting_reflection'
     * On macOS, both 'resume' and 'unlock-screen' events may fire in quick succession
     */
    handleSystemWake(): void {
        const wakeTime = Date.now(); // Capture timestamp synchronously at event time
        this.enqueueOperation(async () => {
            console.log('[SessionManager] handleSystemWake');

            const phase = this.sessionPhase;

            // Handle wake from paused state (system pause)
            if (phase.phase === 'paused' && phase.pauseType === 'system') {
                const durationMs = wakeTime - phase.suspendTime;
                console.log('[SessionManager] Interruption duration (ms):', durationMs);

                // Transition to awaiting_reflection
                this.transitionTo({
                    phase: 'awaiting_reflection',
                    sessionId: phase.sessionId,
                    sessionDate: phase.sessionDate,
                    endTime: phase.endTime,
                    focusGoal: phase.focusGoal,
                    tasks: phase.tasks,
                    pauseType: phase.pauseType,
                    suspendTime: phase.suspendTime,
                    wakeTime,
                    durationMs,
                });

                // Broadcast interruption to renderer for UI prompt
                this.windowManager.broadcastInterruption({ durationMs });
                console.log('[SessionManager] Interruption broadcast to renderer, waiting for user response');
                return;
            }

            // Handle additional sleep cycle while already awaiting reflection
            if (phase.phase === 'awaiting_reflection') {
                // Duplicate event check: if suspendTime hasn't changed, ignore
                if (phase.suspendTime <= phase.wakeTime) {
                    console.log('[SessionManager] Ignoring duplicate wake event');
                    return;
                }

                // New sleep cycle - accumulate duration
                const additionalDuration = wakeTime - phase.suspendTime;
                const newDurationMs = phase.durationMs + additionalDuration;
                console.log('[SessionManager] Already awaiting reflection, accumulating additional duration:', additionalDuration);

                this.transitionTo({
                    ...phase,
                    wakeTime,
                    durationMs: newDurationMs,
                });

                // Update UI with new total duration
                this.windowManager.broadcastInterruption({ durationMs: newDurationMs });
                return;
            }

            console.log('[SessionManager] Ignoring wake - not in system-paused state');
        });
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
            // Allow pauseSession for any running session (it handles updating suspendTime for already-paused states)
            const phase = this.sessionPhase.phase;
            if (phase === 'idle' || phase === 'stopping') return;
            this.pauseSession();
        });

        powerMonitor.on('resume', () => {
            safeLog('[PowerMonitor] resume event');
            this.handleSystemWake();
        });

        powerMonitor.on('lock-screen', () => {
            safeLog('[PowerMonitor] lock-screen event');
            // Allow pauseSession for any running session (it handles updating suspendTime for already-paused states)
            const phase = this.sessionPhase.phase;
            if (phase === 'idle' || phase === 'stopping') return;
            this.pauseSession();
        });

        powerMonitor.on('unlock-screen', () => {
            safeLog('[PowerMonitor] unlock-screen event');
            this.handleSystemWake();
        });

        console.log('[SessionManager] Power monitoring setup complete');
    }
}
