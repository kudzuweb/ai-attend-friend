import { useState, useEffect } from 'react';
import TimerDisplay from './widget-components/TimerDisplay';
import WidgetTaskList from './widget-components/WidgetTaskList';
import InterruptionReflection from './widget-components/InterruptionReflection';
import StuckPrompt from './widget-components/StuckPrompt';
import DistractionPrompt, { type PromptKey } from './widget-components/DistractionPrompt';
import DistractionReflection from './widget-components/DistractionReflection';

interface SessionState {
  isActive: boolean;
  isPaused?: boolean;
  suspendTime?: number;
  lengthMs: number;
  startTime: number;
  endTime: number;
  focusGoal: string;
  tasks?: SessionTask[];
}

type ModalState =
  | { type: 'none' }
  | { type: 'stuck'; startTime: number }
  | { type: 'interruption'; durationMs: number }
  | { type: 'distraction' }
  | { type: 'distraction_reflection'; reasonType: PromptKey; startTime: number };

// UI state machine for widget lifecycle
type WidgetUIPhase =
  | { phase: 'idle' }                                // No session, widget hidden
  | { phase: 'running'; sessionState: SessionState } // Active session
  | { phase: 'cleaning_up' };                        // Session ended, hiding widget

export default function SessionWidgetApp() {
  const [uiPhase, setUIPhase] = useState<WidgetUIPhase>({ phase: 'idle' });
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });

  // Initialize and subscribe to events
  useEffect(() => {
    // Load initial session state
    loadSessionState();

    // Listen for session updates - this drives the state machine
    const unsubscribeSession = window.api.onSessionUpdated((state: SessionState) => {
      handleSessionStateUpdate(state);
    });

    // Listen for interruption events
    const unsubscribeInterruption = window.api.onInterruption((data) => {
      setModalState({ type: 'interruption', durationMs: data.durationMs });
    });

    // Listen for distraction events
    const unsubscribeDistraction = window.api.onDistraction(() => {
      setModalState({ type: 'distraction' });
    });

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsubscribeSession();
      unsubscribeInterruption();
      unsubscribeDistraction();
      clearInterval(timer);
    };
  }, []);

  // Handle session state updates - drives phase transitions
  function handleSessionStateUpdate(sessionState: SessionState) {
    setUIPhase(currentPhase => {
      // Session started: idle -> running
      if (sessionState.isActive && currentPhase.phase === 'idle') {
        return { phase: 'running', sessionState };
      }

      // Session state updated while running: update sessionState in phase
      if (sessionState.isActive && currentPhase.phase === 'running') {
        return { phase: 'running', sessionState };
      }

      // New session started during cleanup: cleaning_up -> running
      // This cancels the cleanup and starts showing the new session
      if (sessionState.isActive && currentPhase.phase === 'cleaning_up') {
        return { phase: 'running', sessionState };
      }

      // Session ended: running -> cleaning_up
      if (!sessionState.isActive && currentPhase.phase === 'running') {
        return { phase: 'cleaning_up' };
      }

      // Ignore other transitions (e.g., inactive updates during cleaning_up)
      return currentPhase;
    });
  }

  // Handle cleanup when entering cleaning_up phase
  useEffect(() => {
    if (uiPhase.phase !== 'cleaning_up') return;

    let cancelled = false;

    (async () => {
      // Reset modal state
      setModalState({ type: 'none' });

      if (cancelled) return;

      await window.api.hideSessionWidget();
      await window.api.restoreMainWindow();

      if (!cancelled) {
        setUIPhase({ phase: 'idle' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uiPhase.phase]);

  async function loadSessionState() {
    const state = await window.api.sessionGetState();
    handleSessionStateUpdate(state);
  }

  async function handleStopSession() {
    if (confirm('End this session?')) {
      await window.api.sessionStop();
      // Note: Phase transition to cleaning_up handled by handleSessionStateUpdate
    }
  }

  async function handlePauseSession() {
    await window.api.pauseSession();
  }

  async function handleResumeSession() {
    await window.api.resumeSession();
  }

  async function handleInterruptionResume(reflection: string) {
    await window.api.handleInterruption('resume', reflection);
    setModalState({ type: 'none' });
  }

  async function handleInterruptionEnd(reflection: string) {
    await window.api.handleInterruption('end', reflection);
    setModalState({ type: 'none' });
    // Note: Phase transition to cleaning_up handled by handleSessionStateUpdate
  }

  async function handleStuckClick() {
    const startTime = Date.now(); // Capture time before pause
    await window.api.pauseSessionForStuck(); // Pause timer while in stuck flow (user-initiated)
    setModalState({ type: 'stuck', startTime });
  }

  async function handleStuckResume(reflection: string) {
    const pauseDurationMs = modalState.type === 'stuck'
      ? Date.now() - modalState.startTime
      : 0;
    await window.api.resumeAfterStuck(reflection, pauseDurationMs);
    setModalState({ type: 'none' });
  }

  async function handleStuckEnd(reflection: string) {
    await window.api.endAfterStuck(reflection);
    setModalState({ type: 'none' });
    // Note: Phase transition to cleaning_up handled by handleSessionStateUpdate
  }

  async function handleDistractionReasonSelected(reasonType: PromptKey) {
    const startTime = Date.now();
    await window.api.pauseSessionForStuck();
    setModalState({ type: 'distraction_reflection', reasonType, startTime });
  }

  async function handleDistractionReflectionResume(formattedContent: string, pauseDurationMs: number) {
    if (formattedContent.trim() && modalState.type === 'distraction_reflection') {
      await window.api.saveDistractionReflection({
        content: formattedContent,
        reasonType: modalState.reasonType,
      });
    }
    await window.api.resumeAfterStuck(formattedContent, pauseDurationMs);
    setModalState({ type: 'none' });
  }

  async function handleDistractionReflectionEnd(formattedContent: string) {
    if (formattedContent.trim() && modalState.type === 'distraction_reflection') {
      await window.api.saveDistractionReflection({
        content: formattedContent,
        reasonType: modalState.reasonType,
      });
    }
    await window.api.endAfterStuck(formattedContent);
    setModalState({ type: 'none' });
    // Note: Phase transition to cleaning_up handled by handleSessionStateUpdate
  }

  async function handleDistractionOpenInMain(formattedContent: string, reasonType: PromptKey) {
    console.log('[SessionWidgetApp] handleDistractionOpenInMain received:', formattedContent);
    if (formattedContent.trim()) {
      const result = await window.api.saveDistractionReflection({
        content: formattedContent,
        reasonType,
      });
      console.log('[SessionWidgetApp] saveDistractionReflection result:', result);
      if (result.ok) {
        await window.api.openReflectionEntry(result.entryId);
      }
    }
    // Keep modal open - user can resume/end from main window later
  }

  // Guard: only show modals when in running phase
  const isRunning = uiPhase.phase === 'running';

  // Show stuck prompt UI when user clicks "Stuck" button
  if (modalState.type === 'stuck' && isRunning) {
    return (
      <div className="session-widget">
        <StuckPrompt
          onResume={handleStuckResume}
          onEnd={handleStuckEnd}
        />
      </div>
    );
  }

  // Show interruption reflection UI when returning from system sleep/lock
  if (modalState.type === 'interruption' && isRunning) {
    return (
      <div className="session-widget">
        <InterruptionReflection
          durationMs={modalState.durationMs}
          onResume={handleInterruptionResume}
          onEnd={handleInterruptionEnd}
        />
      </div>
    );
  }

  // Show distraction prompt UI when AI detects distraction
  if (modalState.type === 'distraction' && isRunning) {
    return (
      <div className="session-widget">
        <DistractionPrompt
          onReasonSelected={handleDistractionReasonSelected}
        />
      </div>
    );
  }

  // Show distraction reflection UI after user selects a reason
  if (modalState.type === 'distraction_reflection' && isRunning) {
    return (
      <div className="session-widget">
        <DistractionReflection
          reasonType={modalState.reasonType}
          startTime={modalState.startTime}
          onResume={handleDistractionReflectionResume}
          onEnd={handleDistractionReflectionEnd}
          onOpenInMain={handleDistractionOpenInMain}
        />
      </div>
    );
  }

  // Not in running phase - show empty state
  if (uiPhase.phase !== 'running') {
    return (
      <div className="session-widget">
        <div className="widget-empty">
          <p>No active session</p>
        </div>
      </div>
    );
  }

  // Running phase - show timer and controls
  const { sessionState } = uiPhase;
  // When paused, use suspendTime to freeze the timer display
  const effectiveTime = sessionState.suspendTime || currentTime;
  const timeElapsed = effectiveTime - sessionState.startTime;
  const timeRemaining = Math.max(0, sessionState.lengthMs - timeElapsed);

  return (
    <div className="session-widget">
      <div className="widget-header">
        <button
          className="play-pause-btn"
          onClick={sessionState.isPaused ? handleResumeSession : handlePauseSession}
          title={sessionState.isPaused ? "Resume" : "Pause"}
        >
          {sessionState.isPaused ? (
            <svg className="play-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          ) : (
            <svg className="pause-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          )}
        </button>
        <TimerDisplay
          timeRemaining={timeRemaining}
          totalTime={sessionState.lengthMs}
        />
      </div>

      <div className="focus-goal">"{sessionState.focusGoal}"</div>

      <WidgetTaskList tasks={sessionState.tasks || []} />

      <div className="widget-actions">
        <button
          className="widget-btn widget-btn-stuck"
          onClick={handleStuckClick}
          title="I'm stuck"
        >
          Stuck?
        </button>
        <button
          className="widget-btn widget-btn-stop"
          onClick={handleStopSession}
          title="End session"
        >
          End session
        </button>
      </div>
    </div>
  );
}
