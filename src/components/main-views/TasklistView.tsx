import { useState, useEffect } from 'react';

export default function TasklistView() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskContent, setNewTaskContent] = useState('');
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [addingSubtaskToId, setAddingSubtaskToId] = useState<string | null>(null);
    const [newSubtaskContent, setNewSubtaskContent] = useState('');
    const [sessionSetupMode, setSessionSetupMode] = useState(false);
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [focusGoal, setFocusGoal] = useState('');
    const [sessionLength, setSessionLength] = useState(25); // minutes

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

    function handleStartEdit(task: Task) {
        setEditingTaskId(task.id);
        setEditingContent(task.content);
    }

    function handleCancelEdit() {
        setEditingTaskId(null);
        setEditingContent('');
    }

    async function handleSaveEdit(taskId: string) {
        if (!editingContent.trim()) return;

        // For now, we'll delete and recreate since we don't have an update endpoint
        // In a real implementation, you'd add an updateTask IPC handler
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            // This is a workaround - ideally we'd have a proper update method
            await window.api.deleteTask(taskId);
            await window.api.createTask({
                content: editingContent.trim(),
                parentTaskId: task.parentTaskId,
            });
            setEditingTaskId(null);
            setEditingContent('');
            await loadTasks();
        }
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

        if (selectedTaskIds.length === 0) {
            alert('Please select at least one task');
            return;
        }

        // Get selected tasks (up to 3 for old format compatibility)
        const selectedTasks = selectedTaskIds
            .slice(0, 3)
            .map(id => tasks.find(t => t.id === id))
            .filter(Boolean) as Task[];

        const tasksTuple: [string, string, string] = [
            selectedTasks[0]?.content || '',
            selectedTasks[1]?.content || '',
            selectedTasks[2]?.content || '',
        ];

        const lengthMs = sessionLength * 60 * 1000;

        const result = await window.api.sessionStart(lengthMs, focusGoal, tasksTuple);

        if (result.ok) {
            // Minimize main window
            await window.api.minimizeMainWindow();

            // Show session widget
            await window.api.showSessionWidget();

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
    }

    function renderTask(task: Task, depth = 0) {
        const isEditing = editingTaskId === task.id;
        const isAddingSubtask = addingSubtaskToId === task.id;
        const subtasks = tasks.filter(t => t.parentTaskId === task.id);
        const isSelected = selectedTaskIds.includes(task.id);

        return (
            <div key={task.id} className="task-item" style={{ marginLeft: `${depth * 20}px` }}>
                <div className="task-row">
                    {sessionSetupMode ? (
                        <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleTaskSelection(task.id)}
                            className="task-checkbox"
                            disabled={!isSelected && selectedTaskIds.length >= 3}
                        />
                    ) : (
                        <input
                            type="checkbox"
                            checked={task.isCompleted}
                            onChange={() => handleToggleComplete(task.id)}
                            className="task-checkbox"
                        />
                    )}

                    {isEditing ? (
                        <div className="task-edit">
                            <input
                                type="text"
                                value={editingContent}
                                onChange={(e) => setEditingContent(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveEdit(task.id);
                                    if (e.key === 'Escape') handleCancelEdit();
                                }}
                                autoFocus
                                className="task-input"
                            />
                            <button onClick={() => handleSaveEdit(task.id)} className="btn-small">Save</button>
                            <button onClick={handleCancelEdit} className="btn-small">Cancel</button>
                        </div>
                    ) : (
                        <div className="task-content">
                            <span className={task.isCompleted ? 'task-text completed' : 'task-text'}>
                                {task.content}
                            </span>
                            {task.isCompleted && task.completedAt && (
                                <span className="task-timestamp">
                                    {new Date(task.completedAt).toLocaleString()}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="task-actions">
                        {!isEditing && (
                            <>
                                <button onClick={() => handleStartEdit(task)} className="btn-small">Edit</button>
                                <button onClick={() => setAddingSubtaskToId(task.id)} className="btn-small">+ Subtask</button>
                                <button onClick={() => handleDelete(task.id)} className="btn-small btn-danger">Delete</button>
                            </>
                        )}
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
                            onChange={(e) => setSessionLength(parseInt(e.target.value) || 25)}
                            min="1"
                            max="180"
                            className="task-input-large"
                        />
                    </div>

                    <div className="form-section">
                        <label>Select Tasks (up to 3)</label>
                        <p className="view-description">Selected: {selectedTaskIds.length}/3</p>
                    </div>
                </div>

                <div className="tasks-list">
                    {topLevelTasks.length === 0 ? (
                        <div className="empty-state">
                            <p>No tasks available. Create some tasks first!</p>
                        </div>
                    ) : (
                        topLevelTasks.map(task => renderTask(task))
                    )}
                </div>

                <div className="session-setup-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                    <button onClick={handleStartSession} className="btn-primary">
                        Start Session
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
                <h1>Tasklist</h1>
                <p className="view-description">Manage your tasks and subtasks</p>
            </div>

            <div className="add-task-section">
                <input
                    type="text"
                    value={newTaskContent}
                    onChange={(e) => setNewTaskContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTask();
                    }}
                    placeholder="Add a new task..."
                    className="task-input-large"
                />
                <button onClick={handleAddTask} className="btn-primary">Add Task</button>
                <button onClick={() => setSessionSetupMode(true)} className="btn-primary" style={{ marginLeft: '12px' }}>
                    Start Session
                </button>
            </div>

            <div className="tasks-list">
                {topLevelTasks.length === 0 ? (
                    <div className="empty-state">
                        <p>No tasks yet. Add your first task above!</p>
                    </div>
                ) : (
                    topLevelTasks.map(task => renderTask(task))
                )}
            </div>
        </div>
    );
}
