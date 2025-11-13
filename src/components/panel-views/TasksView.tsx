import { useState, useEffect } from "react";

export default function TasksView() {
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
            unsubscribe();
        };
    }, []);

    return (
        <>
            <h2 className="panel-title">Tasks</h2>

            {loading ? (
                <div style={{ padding: '16px 0', opacity: 0.7 }}>
                    Loading tasks...
                </div>
            ) : tasks && tasks.some(task => task.trim()) ? (
                <ul className="task-list">
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
