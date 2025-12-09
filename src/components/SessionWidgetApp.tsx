import { useState, useEffect } from 'react';
import TimerDisplay from './widget-components/TimerDisplay';
import WidgetTaskList from './widget-components/WidgetTaskList';

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

  useEffect(() => {
    // Load initial session state
    loadSessionState();

    // Listen for session updates
    const unsubscribe = window.api.onSessionUpdated((state: SessionState) => {
      setSessionState(state);
    });

    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => {
      unsubscribe();
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
      async function cleanup() {
        await window.api.hideSessionWidget();
        await window.api.restoreMainWindow();
        setWasActive(false);
      }
      cleanup();
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
