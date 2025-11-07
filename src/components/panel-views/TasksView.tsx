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
interface TasksViewProps {
    onClose: () => void;
}

export default function TasksView({ onClose }: TasksViewProps) {
    const [tasks, setTasks] = useState<[string, string, string] | null>(null);
    const [loading, setLoading] = useState(true);

    // Fetch session state to get tasks
    useEffect(() => {
        async function loadTasks() {
            try {
                const sessionState = await window.api.sessionGetState();
                if (sessionState.tasks) {
                    setTasks(sessionState.tasks);
                }
            } catch (error) {
                console.error('[TasksView] Error loading session state:', error);
            } finally {
                setLoading(false);
            }
        }

        loadTasks();

        // Listen for session updates
        const unsubscribe = window.api.onSessionUpdated((state) => {
            if (state.tasks) {
                setTasks(state.tasks);
            }
        });

        return () => {
            unsubscribe?.();
        };
    }, []);

    return (
        <>
            <h2 className={'panel'} style={{ fontWeight: 600 }}>tasks</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={'panel'} onClick={onClose}>close</button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '16px 0', opacity: 0.7 }}>
                    loading tasks...
                </div>
            ) : tasks && tasks.some(task => task.trim()) ? (
                <ul
                    style={{
                        background: 'rgba(0,0,0,0.15)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        padding: '12px 24px',
                        margin: '8px 0',
                        lineHeight: 1.8,
                    }}
                >
                    {tasks.map((task, index) => (
                        task.trim() && (
                            <li key={index} style={{ marginBottom: index < tasks.length - 1 ? 8 : 0 }}>
                                {task}
                            </li>
                        )
                    ))}
                </ul>
            ) : (
                <div style={{ padding: '16px 0', opacity: 0.6, fontStyle: 'italic' }}>
                    no tasks set for this session
                </div>
            )}
        </>
    );
}
