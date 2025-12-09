interface TimerDisplayProps {
  timeRemaining: number;
  totalTime: number;
}

export default function TimerDisplay({ timeRemaining, totalTime }: TimerDisplayProps) {
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  // Calculate progress percentage
  const progress = ((totalTime - timeRemaining) / totalTime) * 100;

  // Determine color based on time remaining
  let timerClass = 'timer-normal';
  if (timeRemaining < 300000) { // Less than 5 minutes
    timerClass = 'timer-warning';
  }
  if (timeRemaining < 60000) { // Less than 1 minute
    timerClass = 'timer-critical';
  }

  return (
    <div className="timer-display">
      <div className="timer-progress">
        <svg className="progress-ring" width="120" height="120">
          <circle
            className="progress-ring-bg"
            cx="60"
            cy="60"
            r="54"
            strokeWidth="4"
          />
          <circle
            className={`progress-ring-fill ${timerClass}`}
            cx="60"
            cy="60"
            r="54"
            strokeWidth="4"
            strokeDasharray={`${2 * Math.PI * 54}`}
            strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className={`timer-text ${timerClass}`}>
          <span className="timer-minutes">{minutes}</span>
          <span className="timer-separator">:</span>
          <span className="timer-seconds">{seconds.toString().padStart(2, '0')}</span>
        </div>
      </div>
    </div>
  );
}
