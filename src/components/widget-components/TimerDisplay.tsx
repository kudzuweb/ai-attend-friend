interface TimerDisplayProps {
  timeRemaining: number;
  totalTime: number;
}

export default function TimerDisplay({ timeRemaining }: TimerDisplayProps) {
  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  // Determine color based on time remaining
  let timerClass = '';
  if (timeRemaining < 300000) { // Less than 5 minutes
    timerClass = 'timer-warning';
  }
  if (timeRemaining < 60000) { // Less than 1 minute
    timerClass = 'timer-critical';
  }

  return (
    <div className={`timer-pill ${timerClass}`}>
      <span className="timer-minutes">{minutes}</span>
      <span className="timer-separator">:</span>
      <span className="timer-seconds">{seconds.toString().padStart(2, '0')}</span>
    </div>
  );
}
