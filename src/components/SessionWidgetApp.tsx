import { useState, useEffect } from 'react';
import TimerDisplay from './widget-components/TimerDisplay';
import WidgetTaskList from './widget-components/WidgetTaskList';
import InterruptionReflection from './widget-components/InterruptionReflection';

interface SessionState {
  isActive: boolean;
  lengthMs: number;
  startTime: number;
  endTime: number;
  focusGoal: string;
  tasks?: [string, string, string];
}

export default function SessionWidgetApp() {
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [wasActive, setWasActive] = useState(false);
  const [interruptionMode, setInterruptionMode] = useState(false);
  const [interruptionDuration, setInterruptionDuration] = useState(0);

  useEffect(() => {
    // Load initial session state
    loadSessionState();

    // Listen for session updates
    const unsubscribeSession = window.api.onSessionUpdated((state: SessionState) => {
      setSessionState(state);
    });

    // Listen for interruption events
    const unsubscribeInterruption = window.api.onInterruption((data) => {
      setInterruptionMode(true);
      setInterruptionDuration(data.durationMs);
    });

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsubscribeSession();
      unsubscribeInterruption();
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
    setInterruptionMode(false);
    setInterruptionDuration(0);
  }

  async function handleInterruptionEnd(reflection: string) {
    await window.api.handleInterruption('end', reflection);
    setInterruptionMode(false);
    setInterruptionDuration(0);
    // Note: Window cleanup will be handled by the useEffect that watches sessionState.isActive
  }

  // Show interruption reflection UI when returning from system sleep/lock
  if (interruptionMode && sessionState?.isActive) {
    return (
      <div className="session-widget">
        <InterruptionReflection
          durationMs={interruptionDuration}
          onResume={handleInterruptionResume}
          onEnd={handleInterruptionEnd}
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
