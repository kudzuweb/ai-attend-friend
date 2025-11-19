import { useState, useEffect, useRef } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { DEFAULT_SESSION_DURATION_MS, INPUT_MAX_LENGTH } from "../../constants";

interface SessionSetupViewProps {
    onComplete: () => void;
    onCancel: () => void;
}

export default function SessionSetupView({ onComplete, onCancel }: SessionSetupViewProps) {
    const [selectedDuration, setSelectedDuration] = useState<number>(DEFAULT_SESSION_DURATION_MS); // 25 mins default
    const [focusGoal, setFocusGoal] = useState<string>('');
    const [tasks, setTasks] = useState<[string, string, string]>(['', '', '']);
    const dialRef = useRef<HTMLDivElement>(null);

    const { settings } = useSettings();
    const showTasks = settings?.tasksEnabled ?? true;

    // Convert selectedDuration (in ms) to minutes for display
    const durationMinutes = selectedDuration / (60 * 1000);

    const handleDurationChange = (minutes: number) => {
        setSelectedDuration(Math.max(1, minutes) * 60 * 1000); // at least 1 minute
    };

    async function handleStartSession() {
        const tasksToSend = showTasks ? tasks : undefined;
        const hasTasks = tasksToSend && tasksToSend.some(t => t.trim());

        const res = await window.api.sessionStart(selectedDuration, focusGoal, tasksToSend);
        if (res.ok) {
            // Only call onComplete and hide panel if no tasks
            // When tasks are present, the backend will handle showing the tasks view
            if (!hasTasks) {
                onComplete();
                await window.api.hidePanel();
            }
            // When tasks are present, don't call onComplete() - let the IPC event handler manage the view change
        } else {
            console.error('Failed to start session:', res.error);
        }
    }

    function handleCancel() {
        setFocusGoal('');
        setTasks(['', '', '']);
        onCancel();
        window.api.hidePanel();
    }

    // Set up non-passive wheel listener for the dial
    useEffect(() => {
        const dial = dialRef.current;
        if (!dial) return;

        const handleWheel = (e: WheelEvent) => {
            // Only intercept scroll if cursor is over the dial element
            if (dial.dataset.active === 'true') {
                e.preventDefault();
                const direction = e.deltaY < 0 ? 1 : -1;
                handleDurationChange(Math.max(1, durationMinutes + direction));
            }
        };

        // Add non-passive listener so preventDefault() works
        dial.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            dial.removeEventListener('wheel', handleWheel);
        };
    }, [durationMinutes]);

    return (
        <>
            <h2 className="panel-title">New Session</h2>
            <div className="panel-content">
                <div className="form-section-group">
                    <label>Duration</label>
                    <div className="duration-controls">
                        <button
                            className="duration-button"
                            onClick={() => handleDurationChange(Math.max(1, durationMinutes - 1))}
                        >
                            −
                        </button>
                        <div
                            ref={dialRef}
                            className="duration-display"
                            onMouseEnter={(e) => {
                                e.currentTarget.dataset.active = 'true';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.dataset.active = 'false';
                            }}
                        >
                            {Math.round(durationMinutes)}
                        </div>
                        <button
                            className="duration-button"
                            onClick={() => handleDurationChange(durationMinutes + 1)}
                        >
                            +
                        </button>
                    </div>
                    <span className="duration-label">minutes</span>
                </div>
                <input
                    type="text"
                    className="panel-input"
                    value={focusGoal}
                    onChange={(e) => setFocusGoal(e.target.value.slice(0, INPUT_MAX_LENGTH))}
                    maxLength={INPUT_MAX_LENGTH}
                    placeholder="What would you like to focus on?"
                />
                {showTasks && (
                    <div className="form-section">
                        <label className="mb-4">Priority Tasks</label>
                        {[0, 1, 2].map((index) => (
                            <input
                                key={index}
                                type="text"
                                className="panel-input"
                                value={tasks[index]}
                                onChange={(e) => {
                                    const newTasks: [string, string, string] = [...tasks] as [string, string, string];
                                    newTasks[index] = e.target.value.slice(0, INPUT_MAX_LENGTH);
                                    setTasks(newTasks);
                                }}
                                maxLength={INPUT_MAX_LENGTH}
                                placeholder={`Task ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
                <div className="button-group">
                    <button className="button-primary" onClick={handleStartSession}>
                        Start session
                    </button>
                    <button className="button-secondary" onClick={handleCancel}>
                        Cancel
                    </button>
                </div>
            </div>
        </>
    );
}
