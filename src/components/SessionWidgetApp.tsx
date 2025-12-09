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

  async function loadSessionState() {
    const state = await window.api.sessionGetState();
    setSessionState(state);
  }

  async function handleStopSession() {
    if (confirm('End this session?')) {
      await window.api.sessionStop();

      // Hide session widget
      await window.api.hideSessionWidget();

      // Restore main window
      await window.api.restoreMainWindow();

      setSessionState(null);
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
