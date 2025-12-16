import { useState, useEffect } from 'react';
import TimerDisplay from './widget-components/TimerDisplay';
import WidgetTaskList from './widget-components/WidgetTaskList';
import InterruptionReflection from './widget-components/InterruptionReflection';
import StuckPrompt from './widget-components/StuckPrompt';
import DistractionPrompt from './widget-components/DistractionPrompt';

interface SessionState {
  isActive: boolean;
  lengthMs: number;
  startTime: number;
  endTime: number;
  focusGoal: string;
  tasks?: [string, string, string];
}

type ModalState =
  | { type: 'none' }
  | { type: 'stuck'; startTime: number }
  | { type: 'interruption'; durationMs: number }
  | { type: 'distraction'; analysis: string; suggestedPrompt: string };

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
    const unsubscribeDistraction = window.api.onDistraction((data) => {
      setModalState({
        type: 'distraction',
        analysis: data.analysis,
        suggestedPrompt: data.suggestedPrompt
      });
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

      // Session ended: running -> cleaning_up
      if (!sessionState.isActive && currentPhase.phase === 'running') {
        return { phase: 'cleaning_up' };
      }

      // Ignore other transitions (e.g., updates during cleaning_up)
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

  async function handleDistractionResume(reason: string) {
    if (reason.trim()) {
      await window.api.saveDistractionReason(reason);
    }
    setModalState({ type: 'none' });
  }

  async function handleDistractionEnd(reason: string) {
    if (reason.trim()) {
      await window.api.saveDistractionReason(reason);
    }
    await window.api.sessionStop();
    setModalState({ type: 'none' });
    // Note: Phase transition to cleaning_up handled by handleSessionStateUpdate
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
          analysis={modalState.analysis}
          suggestedPrompt={modalState.suggestedPrompt}
          onResume={handleDistractionResume}
          onEnd={handleDistractionEnd}
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
  const timeElapsed = currentTime - sessionState.startTime;
  const timeRemaining = Math.max(0, sessionState.lengthMs - timeElapsed);

  return (
    <div className="session-widget">
      <div className="widget-header">
        <div className="focus-goal">{sessionState.focusGoal}</div>
      </div>

      <TimerDisplay
        timeRemaining={timeRemaining}
        totalTime={sessionState.lengthMs}
      />

      <WidgetTaskList tasks={sessionState.tasks || ['', '', '']} />

      <div className="widget-actions">
        <button
          className="widget-btn widget-btn-stuck"
          onClick={handleStuckClick}
          title="I'm stuck"
        >
          Stuck
        </button>
        <button
          className="widget-btn widget-btn-pause"
          onClick={handlePauseSession}
          title="Pause session"
        >
          Pause
        </button>
        <button
          className="widget-btn widget-btn-stop"
          onClick={handleStopSession}
          title="Stop session"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
