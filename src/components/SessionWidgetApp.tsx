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

export default function SessionWidgetApp() {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [wasActive, setWasActive] = useState(false);
  const [modalState, setModalState] = useState<ModalState>({ type: 'none' });

  useEffect(() => {
    // Load initial session state
    loadSessionState();

    // Listen for session updates
    const unsubscribeSession = window.api.onSessionUpdated((state: SessionState) => {
      setSessionState(state);
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

  // Track when session becomes active
  useEffect(() => {
    if (sessionState?.isActive) {
      setWasActive(true);
    }
  }, [sessionState?.isActive]);

  // Handle session end (natural expiration only)
  useEffect(() => {
    if (wasActive && sessionState && !sessionState.isActive) {
      // Reset modal state on session end
      setModalState({ type: 'none' });

      // Session just ended naturally, clean up windows
      let cancelled = false;

      (async () => {
        // Check if a new session started before we hide the widget
        if (cancelled) return;

        await window.api.hideSessionWidget();
        await window.api.restoreMainWindow();

        // Only reset wasActive if we weren't cancelled
        if (!cancelled) {
          setWasActive(false);
        }
      })();

      // If session becomes active again before cleanup completes, cancel it
      return () => {
        cancelled = true;
      };
    }
  }, [sessionState?.isActive, wasActive]);

  async function loadSessionState() {
    const state = await window.api.sessionGetState();
    setSessionState(state);
  }

  async function handleStopSession() {
    if (confirm('End this session?')) {
      await window.api.sessionStop();
      // Note: Window cleanup will be handled by the useEffect that watches sessionState.isActive
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
    // Note: Window cleanup will be handled by the useEffect that watches sessionState.isActive
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
    // Note: Window cleanup will be handled by the useEffect that watches sessionState.isActive
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
    // Note: Window cleanup will be handled by the useEffect that watches sessionState.isActive
  }

  // Show stuck prompt UI when user clicks "Stuck" button
  if (modalState.type === 'stuck' && sessionState?.isActive) {
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
  if (modalState.type === 'interruption' && sessionState?.isActive) {
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
  if (modalState.type === 'distraction' && sessionState?.isActive) {
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

  if (!sessionState || !sessionState.isActive) {
    return (
      <div className="session-widget">
        <div className="widget-empty">
          <p>No active session</p>
        </div>
      </div>
    );
  }

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
