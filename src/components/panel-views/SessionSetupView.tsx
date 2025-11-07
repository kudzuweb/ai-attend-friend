import { useState, useEffect, useRef } from "react";

interface SessionSetupViewProps {
    onComplete: () => void;
    onCancel: () => void;
}

export default function SessionSetupView({ onComplete, onCancel }: SessionSetupViewProps) {
    const [selectedDuration, setSelectedDuration] = useState<number>(25 * 60 * 1000); // 25 mins default
    const [focusGoal, setFocusGoal] = useState<string>('');
    const [tasks, setTasks] = useState<[string, string, string]>(['', '', '']);
    // TODO: Replace with actual condition when ready
    const [showTasks, setShowTasks] = useState<boolean>(true); // Placeholder state
    const dialRef = useRef<HTMLDivElement>(null);

    // Convert selectedDuration (in ms) to minutes for display
    const durationMinutes = selectedDuration / (60 * 1000);

    const handleDurationChange = (minutes: number) => {
        setSelectedDuration(Math.max(1, minutes) * 60 * 1000); // at least 1 minute
    };

    async function handleStartSession() {
        const res = await window.api.sessionStart(selectedDuration, focusGoal, tasks);
        if (res.ok) {
            onComplete();
            await window.api.hidePanel();
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
            <h2 className={'panel'} style={{ fontWeight: 600 }}>new session</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 14 }}>duration</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button
                            onClick={() => handleDurationChange(Math.max(1, durationMinutes - 1))}
                            style={{
                                width: 40,
                                height: 40,
                                fontSize: 20,
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            −
                        </button>
                        <div
                            ref={dialRef}
                            onMouseEnter={(e) => {
                                e.currentTarget.dataset.active = 'true';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.dataset.active = 'false';
                            }}
                            style={{
                                minWidth: 80,
                                textAlign: 'center',
                                fontSize: 32,
                                fontWeight: 600,
                                cursor: 'ns-resize',
                            }}
                        >
                            {Math.round(durationMinutes)}
                        </div>
                        <button
                            onClick={() => handleDurationChange(durationMinutes + 1)}
                            style={{
                                width: 40,
                                height: 40,
                                fontSize: 20,
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 6,
                                cursor: 'pointer',
                                color: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            +
                        </button>
                    </div>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>minutes</span>
                </div>
                <input
                    type="text"
                    value={focusGoal}
                    onChange={(e) => setFocusGoal(e.target.value)}
                    placeholder="What would you like to focus on?"
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 6,
                        padding: '10px 12px',
                        color: 'inherit',
                        fontSize: 14,
                        width: '100%',
                        boxSizing: 'border-box',
                    }}
                />
                {showTasks && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>priority tasks (optional)</label>
                        {[0, 1, 2].map((index) => (
                            <input
                                key={index}
                                type="text"
                                value={tasks[index]}
                                onChange={(e) => {
                                    const newTasks: [string, string, string] = [...tasks] as [string, string, string];
                                    newTasks[index] = e.target.value;
                                    setTasks(newTasks);
                                }}
                                placeholder={`Task ${index + 1}`}
                                style={{
                                    background: 'rgba(0,0,0,0.15)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: 5,
                                    padding: '8px 10px',
                                    color: 'inherit',
                                    fontSize: 13,
                                    width: '100%',
                                    boxSizing: 'border-box',
                                }}
                            />
                        ))}
                    </div>
                )}
                <button
                    className={'panel'}
                    onClick={handleStartSession}
                    style={{
                        background: '#8B7355',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 6,
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginTop: 8,
                    }}
                >
                    start session
                </button>
                <button
                    className={'panel'}
                    onClick={handleCancel}
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                    }}
                >
                    cancel
                </button>
            </div>
        </>
    );
}
