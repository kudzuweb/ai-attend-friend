import { useState, useEffect } from 'react';

export default function TasklistView() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskContent, setNewTaskContent] = useState('');
    const [addingSubtaskToId, setAddingSubtaskToId] = useState<string | null>(null);
    const [newSubtaskContent, setNewSubtaskContent] = useState('');
    const [sessionSetupMode, setSessionSetupMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [focusGoal, setFocusGoal] = useState('');
    const [sessionLength, setSessionLength] = useState(25); // minutes
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    useEffect(() => {
        loadTasks();
    }, []);

    async function loadTasks() {
        const result = await window.api.getTasks();
        if (result.ok) {
            setTasks(result.tasks);
        }
    }

    async function handleAddTask() {
        if (!newTaskContent.trim()) return;

        const result = await window.api.createTask({
            content: newTaskContent.trim(),
            parentTaskId: null,
        });

        if (result.ok) {
            setNewTaskContent('');
            await loadTasks();
        }
    }

    async function handleAddSubtask(parentTaskId: string) {
        if (!newSubtaskContent.trim()) return;

        const result = await window.api.createTask({
            content: newSubtaskContent.trim(),
            parentTaskId: parentTaskId,
        });

        if (result.ok) {
            setNewSubtaskContent('');
            setAddingSubtaskToId(null);
            await loadTasks();
        }
    }

    async function handleToggleComplete(taskId: string) {
        await window.api.toggleTaskComplete(taskId);
        await loadTasks();
    }

    async function handleDelete(taskId: string) {
        if (confirm('Delete this task? (Subtasks will also be deleted)')) {
            await window.api.deleteTask(taskId);
            await loadTasks();
        }
    }

    async function handleUpdateTask(taskId: string, newContent: string) {
        if (!newContent.trim()) return;
        await window.api.updateTask(taskId, { content: newContent.trim() });
        await loadTasks();
    }

    function handleToggleTaskSelection(taskId: string) {
        setSelectedTaskIds(prev =>
            prev.includes(taskId)
                ? prev.filter(id => id !== taskId)
                : [...prev, taskId]
        );
    }

    async function handleStartSession() {
        if (!focusGoal.trim()) {
            alert('Please enter a focus goal');
            return;
        }

        // Get selected tasks
        const selectedTasks = selectedTaskIds
            .map(id => tasks.find(t => t.id === id))
            .filter(Boolean) as Task[];

        if (selectedTasks.length === 0) {
            alert('Please select at least one task');
            return;
        }

        const taskContents = selectedTasks.map(t => t.content);

        const lengthMs = sessionLength * 60 * 1000;

        const result = await window.api.sessionStart(lengthMs, focusGoal, taskContents);

        if (result.ok) {
            // Show session widget first to ensure seamless transition
            await window.api.showSessionWidget();

            // Then minimize main window
            await window.api.minimizeMainWindow();

            // Reset session setup mode
            setSessionSetupMode(false);
            setSelectedTaskIds([]);
            setFocusGoal('');
        } else {
            alert('Failed to start session');
        }
    }

    function handleCancelSessionSetup() {
        setSessionSetupMode(false);
        setSelectedTaskIds([]);
        setFocusGoal('');
        setSessionLength(25);
    }

    function renderTask(task: Task, depth = 0) {
        const isAddingSubtask = addingSubtaskToId === task.id;
        const subtasks = tasks.filter(t => t.parentTaskId === task.id);
        const isSelected = selectedTaskIds.includes(task.id);
        const isActive = activeTaskId === task.id;

        return (
            <div
                key={task.id}
                className={`task-item ${isActive ? 'active' : ''}`}
                style={{ marginLeft: `${depth * 20}px` }}
                onClick={() => setActiveTaskId(task.id)}
            >
                <div className="task-row">
                    <div className="drag-handle" title="Drag to reorder">
                        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="1" y1="3" x2="13" y2="3" />
                            <line x1="1" y1="7" x2="13" y2="7" />
                        </svg>
                    </div>
                    {sessionSetupMode ? (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleTaskSelection(task.id)}
                            className="task-checkbox"
                        />
                    ) : (
                        <input
                            type="checkbox"
                            checked={task.isCompleted}
                            onChange={() => handleToggleComplete(task.id)}
                            className="task-checkbox"
                        />
                    )}

                    <input
                        type="text"
                        defaultValue={task.content}
                        onBlur={(e) => {
                            if (e.target.value !== task.content) {
                                handleUpdateTask(task.id, e.target.value);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.currentTarget.blur();
                            }
                        }}
                        className={`task-inline-input ${task.isCompleted ? 'completed' : ''}`}
                    />

                    <div className="task-actions">
                        {!task.parentTaskId && (
                            <button onClick={(e) => { e.stopPropagation(); setAddingSubtaskToId(task.id); }} className="btn-icon" title="Add Subtask">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="btn-icon btn-icon-danger" title="Delete">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                </div>

                {isAddingSubtask && (
                    <div className="add-subtask" style={{ marginLeft: '20px', marginTop: '8px' }}>
                        <input
                            type="text"
                            value={newSubtaskContent}
                            onChange={(e) => setNewSubtaskContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddSubtask(task.id);
                                if (e.key === 'Escape') {
                                    setAddingSubtaskToId(null);
                                    setNewSubtaskContent('');
                                }
                            }}
                            placeholder="New subtask..."
                            autoFocus
                            className="task-input"
                        />
                        <button onClick={() => handleAddSubtask(task.id)} className="btn-small">Add</button>
                        <button onClick={() => {
                            setAddingSubtaskToId(null);
                            setNewSubtaskContent('');
                        }} className="btn-small">Cancel</button>
                    </div>
                )}

                {subtasks.length > 0 && (
                    <div className="subtasks">
                        {subtasks.map(subtask => renderTask(subtask, depth + 1))}
                    </div>
                )}
            </div>
        );
    }

    // Get only top-level tasks (no parent)
    const topLevelTasks = tasks.filter(t => !t.parentTaskId && !t.isDeleted);

    if (sessionSetupMode) {
        return (
            <div className="tasklist-view">
                <div className="view-header">
                    <h1>Start a Session</h1>
                    <p className="view-description">Select tasks and set your focus goal</p>
                </div>

                <div className="session-setup-form">
                    <div className="form-section">
                        <label>Focus Goal</label>
                        <input
                            type="text"
                            value={focusGoal}
                            onChange={(e) => setFocusGoal(e.target.value)}
                            placeholder="What will you focus on?"
                            className="task-input-large"
                        />
                    </div>

                    <div className="form-section">
                        <label>Session Length (minutes)</label>
                        <input
                            type="number"
                            value={sessionLength}
                            onChange={(e) => {
                                const value = parseInt(e.target.value);
                                setSessionLength(isNaN(value) || value < 1 ? 25 : Math.min(value, 180));
                            }}
                            min="1"
                            max="180"
                            className="task-input-large"
                        />
                    </div>

                    <div className="form-section">
                        <label>Select Tasks</label>
                    </div>
                </div>

                <div className="unified-card">
                    <div className="card-input-row">
                        <input
                            type="text"
                            value={newTaskContent}
                            onChange={(e) => setNewTaskContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newTaskContent.trim()) {
                                    handleAddTask();
                                }
                            }}
                            placeholder="Add a new task..."
                            className="card-input"
                        />
                        <button onClick={handleAddTask} className="btn-primary">Add</button>
                    </div>

                    <div className="card-items">
                        {topLevelTasks.length === 0 ? (
                            <div className="empty-state">
                                <p>No tasks yet. Add one above to get started!</p>
                            </div>
                        ) : (
                            topLevelTasks.map(task => renderTask(task))
                        )}
                    </div>
                </div>

                <div className="session-setup-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                    <button onClick={handleStartSession} className="btn-primary btn-with-icon">
                        <span>Start Session</span>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    <button onClick={handleCancelSessionSetup} className="btn-small">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="tasklist-view">
            <div className="view-header">
                <div className="view-header-row">
                    <h1>Focus</h1>
                    <button onClick={() => setSessionSetupMode(true)} className="btn-primary btn-with-icon">
                        <span>Start Session</span>
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                </div>
                <p className="view-description">Set intentions for your session</p>
            </div>

            <div className="unified-card">
                <div className="card-input-row">
                    <input
                        type="text"
                        value={newTaskContent}
                        onChange={(e) => setNewTaskContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddTask();
                        }}
                        placeholder="Add a new task..."
                        className="card-input"
                    />
                    <button onClick={handleAddTask} className="btn-primary">Add</button>
                </div>

                <div className="card-items">
                    {topLevelTasks.length === 0 ? (
                        <div className="empty-state">
                            <p>No tasks yet. Add your first task above!</p>
                        </div>
                    ) : (
                        topLevelTasks.map(task => renderTask(task))
                    )}
                </div>
            </div>
        </div>
    );
}
