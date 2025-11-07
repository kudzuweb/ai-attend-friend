import { useState, useEffect } from "react";

export default function TasksView() {
    const [sessionState, setSessionState] = useState<SessionState | null>(null);

    useEffect(() => {
        // Load initial session state
        window.api.sessionGetState().then(setSessionState);

        // Listen for session updates
        window.api.onSessionUpdated((state) => {
            setSessionState(state);
        });
    }, []);

    if (!sessionState?.isActive || !sessionState?.tasks) {
        return (
            <div>
                <h2 className={'panel'} style={{ fontWeight: 600 }}>tasks</h2>
                <p style={{ opacity: 0.7, fontSize: 14 }}>No active session with tasks.</p>
            </div>
        );
    }

    const tasks = sessionState.tasks.filter(task => task.trim());


    return (
        <>
            <h2 className={'panel'} style={{ fontWeight: 600 }}>priority tasks</h2>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 16
            }}>
                <div style={{ fontSize: 14, opacity: 0.7 }}>
                    {sessionState.focusGoal}
                </div>
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12
            }}>
                {tasks.map((task, index) => (
                    <div
                        key={index}
                        style={{
                            background: 'rgba(0,0,0,0.15)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 5,
                            padding: '12px',
                            fontSize: 13,
                        }}
                    >
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{
                                opacity: 0.5,
                                fontSize: 11,
                                fontWeight: 600
                            }}>
                                {index + 1}
                            </span>
                            <span>{task}</span>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
