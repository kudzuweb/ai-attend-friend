import { systemPreferences } from 'electron';
import type { WindowManager } from './WindowManager.js';
import type { ScreenshotService } from './ScreenshotService.js';
import { SCREENSHOT_INTERVAL_MS } from '../constants.js';

// Capture orchestration state machine
type CapturePhase =
    | { phase: 'disabled' }                                      // No session, capture off
    | { phase: 'idle' }                                          // Ready to capture
    | { phase: 'permission_denied'; reason: string }             // User denied permission
    | { phase: 'capturing' }                                     // Capture in progress
    | { phase: 'saving'; dataUrl: string; capturedAt: string }   // Save in progress
    | { phase: 'error'; error: string; retryCount: number };     // Capture failed

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

export class CaptureOrchestrator {
    private phase: CapturePhase = { phase: 'disabled' };
    private captureTimer: NodeJS.Timeout | null = null;
    private intervalMs: number = SCREENSHOT_INTERVAL_MS;

    constructor(
        private windowManager: WindowManager,
        private screenshotService: ScreenshotService
    ) {}

    getPhase(): CapturePhase {
        return this.phase;
    }

    private transitionTo(newPhase: CapturePhase): void {
        const oldPhase = this.phase.phase;
        console.log(`[CaptureOrchestrator] Phase: ${oldPhase} → ${newPhase.phase}`);
        this.phase = newPhase;
    }

    /**
     * Enable capture (called when session starts)
     */
    async enable(intervalMs?: number): Promise<void> {
        if (this.phase.phase !== 'disabled') {
            console.log('[CaptureOrchestrator] Already enabled');
            return;
        }

        this.intervalMs = intervalMs ?? SCREENSHOT_INTERVAL_MS;

        // Check screen recording permission
        const status = this.checkPermission();

        if (status !== 'granted') {
            this.transitionTo({
                phase: 'permission_denied',
                reason: `Screen recording ${status}`
            });
            console.warn(`[CaptureOrchestrator] Screen recording permission: ${status}`);
            return;
        }

        this.transitionTo({ phase: 'idle' });
        this.startCaptureLoop();
    }

    /**
     * Disable capture (called when session ends)
     */
    disable(): void {
        this.stopCaptureLoop();
        this.transitionTo({ phase: 'disabled' });
    }

    /**
     * Pause capture (called when session pauses)
     */
    pause(): void {
        console.log('[CaptureOrchestrator] Pausing capture');
        this.stopCaptureLoop();
        // Stay in current phase (idle or error) but don't capture
    }

    /**
     * Resume capture (called when session resumes)
     */
    resume(): void {
        console.log('[CaptureOrchestrator] Resuming capture');
        if (this.phase.phase === 'idle' || this.phase.phase === 'error') {
            // If in error state, reset to idle
            if (this.phase.phase === 'error') {
                this.transitionTo({ phase: 'idle' });
            }
            this.startCaptureLoop();
        } else if (this.phase.phase === 'permission_denied') {
            // Try permission check again on resume
            const status = this.checkPermission();
            if (status === 'granted') {
                this.transitionTo({ phase: 'idle' });
                this.startCaptureLoop();
            }
        }
    }

    private checkPermission(): string {
        try {
            return systemPreferences.getMediaAccessStatus('screen');
        } catch {
            return 'unknown';
        }
    }

    private startCaptureLoop(): void {
        this.stopCaptureLoop();

        // First capture after intervalMs, then every intervalMs
        this.captureTimer = setTimeout(() => {
            this.triggerCapture();

            // Set up recurring interval
            this.captureTimer = setInterval(() => {
                this.triggerCapture();
            }, this.intervalMs);
        }, this.intervalMs);

        console.log(`[CaptureOrchestrator] Capture loop started (interval: ${this.intervalMs}ms)`);
    }

    private stopCaptureLoop(): void {
        if (this.captureTimer) {
            clearTimeout(this.captureTimer);
            clearInterval(this.captureTimer);
            this.captureTimer = null;
        }
    }

    private triggerCapture(): void {
        if (this.phase.phase !== 'idle') {
            console.log(`[CaptureOrchestrator] Skipping capture - phase is ${this.phase.phase}`);
            return;
        }

        this.transitionTo({ phase: 'capturing' });
        this.windowManager.triggerScreenshotCapture();
    }

    /**
     * Called by IPC handler when capture completes in renderer
     */
    async handleCaptureResult(result: {
        ok: true; dataUrl: string; capturedAt: string
    } | {
        ok: false; error: string
    }): Promise<void> {
        if (this.phase.phase !== 'capturing') {
            console.log('[CaptureOrchestrator] Ignoring result - not capturing');
            return;
        }

        if (!result.ok) {
            console.error('[CaptureOrchestrator] Capture failed:', result.error);
            this.transitionTo({ phase: 'error', error: result.error, retryCount: 0 });
            this.scheduleRetry();
            return;
        }

        this.transitionTo({
            phase: 'saving',
            dataUrl: result.dataUrl,
            capturedAt: result.capturedAt
        });

        try {
            await this.screenshotService.saveScreenshot(result.dataUrl, result.capturedAt);
            this.transitionTo({ phase: 'idle' });
        } catch (e: any) {
            console.error('[CaptureOrchestrator] Save failed:', e);
            this.transitionTo({
                phase: 'error',
                error: e?.message ?? 'Save failed',
                retryCount: 0
            });
            this.scheduleRetry();
        }
    }

    private scheduleRetry(): void {
        if (this.phase.phase !== 'error') return;

        const { retryCount } = this.phase;

        if (retryCount >= MAX_RETRIES) {
            console.error('[CaptureOrchestrator] Max retries exceeded, staying in error state until next interval');
            // Will transition back to idle on next capture interval
            setTimeout(() => {
                if (this.phase.phase === 'error') {
                    this.transitionTo({ phase: 'idle' });
                }
            }, this.intervalMs);
            return;
        }

        console.log(`[CaptureOrchestrator] Scheduling retry ${retryCount + 1}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms`);

        setTimeout(() => {
            if (this.phase.phase === 'error') {
                const currentRetryCount = this.phase.retryCount;
                this.transitionTo({ phase: 'idle' });
                // Trigger immediate capture on retry
                if (this.phase.phase === 'idle') {
                    this.transitionTo({ phase: 'capturing' });
                    this.windowManager.triggerScreenshotCapture();
                    // Update retry count for next potential failure
                    // Note: we track this implicitly through the error → retry cycle
                }
            }
        }, RETRY_DELAY_MS);
    }
}
