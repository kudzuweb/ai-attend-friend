import { useState, useEffect } from 'react';

export default function OpenLoopsView() {
    const [loops, setLoops] = useState<OpenLoop[]>([]);
    const [newLoopContent, setNewLoopContent] = useState('');
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        loadLoops();
    }, [showArchived]);

    async function loadLoops() {
        const result = await window.api.getOpenLoops(showArchived);
        if (result.ok) {
            setLoops(result.loops);
        }
    }

    async function handleAddLoop() {
        if (!newLoopContent.trim()) return;

        const result = await window.api.createOpenLoop({
            content: newLoopContent.trim(),
        });

        if (result.ok) {
            setNewLoopContent('');
            await loadLoops();
        }
    }

    async function handleToggleComplete(loopId: string) {
        await window.api.toggleOpenLoopComplete(loopId);
        await loadLoops();
    }

    async function handleArchive(loopId: string) {
        await window.api.archiveOpenLoop(loopId);
        await loadLoops();
    }

    async function handleConvertToTask(loop: OpenLoop) {
        // Create a new task from the loop content
        const result = await window.api.createTask({
            content: loop.content,
            parentTaskId: null,
            sourceLoopId: loop.id,
        });

        if (result.ok) {
            // Archive the loop after converting
            await handleArchive(loop.id);
        }
    }

    const activeLoops = loops.filter(l => !l.archivedAt && !l.completedAt);
    const completedLoops = loops.filter(l => l.completedAt && !l.archivedAt);
    const archivedLoops = loops.filter(l => l.archivedAt);

    return (
        <div className="openloops-view">
            <div className="view-header">
                <h1>Open Loops</h1>
                <p className="view-description">
                    Capture thoughts and ideas that need to be processed later
                </p>
            </div>

            <div className="add-loop-section">
                <input
                    type="text"
                    value={newLoopContent}
                    onChange={(e) => setNewLoopContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddLoop();
                    }}
                    placeholder="What's on your mind?"
                    className="task-input-large"
                />
                <button onClick={handleAddLoop} className="btn-primary">Add Loop</button>
            </div>

            <div className="view-controls">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={showArchived}
                        onChange={(e) => setShowArchived(e.target.checked)}
                    />
                    Show archived loops
                </label>
            </div>

            {activeLoops.length > 0 && (
                <div className="loop-section">
                    <h2 className="section-title">Active Loops</h2>
                    <div className="loops-list">
                        {activeLoops.map(loop => (
                            <div key={loop.id} className="loop-item">
                                <div className="loop-content">
                                    <p className="loop-text">{loop.content}</p>
                                    <span className="loop-timestamp">
                                        {new Date(loop.createdAt).toLocaleString()}
                                    </span>
                                </div>
                                <div className="loop-actions">
                                    <button
                                        onClick={() => handleConvertToTask(loop)}
                                        className="btn-small btn-convert"
                                        title="Convert to Task"
                                    >
                                        → Task
                                    </button>
                                    <button
                                        onClick={() => handleToggleComplete(loop.id)}
                                        className="btn-small"
                                    >
                                        Complete
                                    </button>
                                    <button
                                        onClick={() => handleArchive(loop.id)}
                                        className="btn-small"
                                    >
                                        Archive
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {completedLoops.length > 0 && (
                <div className="loop-section">
                    <h2 className="section-title">Completed Loops</h2>
                    <div className="loops-list">
                        {completedLoops.map(loop => (
                            <div key={loop.id} className="loop-item completed">
                                <div className="loop-content">
                                    <p className="loop-text">{loop.content}</p>
                                    <span className="loop-timestamp">
                                        Completed: {new Date(loop.completedAt!).toLocaleString()}
                                    </span>
                                </div>
                                <div className="loop-actions">
                                    <button
                                        onClick={() => handleToggleComplete(loop.id)}
                                        className="btn-small"
                                    >
                                        Reopen
                                    </button>
                                    <button
                                        onClick={() => handleArchive(loop.id)}
                                        className="btn-small"
                                    >
                                        Archive
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showArchived && archivedLoops.length > 0 && (
                <div className="loop-section">
                    <h2 className="section-title">Archived Loops</h2>
                    <div className="loops-list">
                        {archivedLoops.map(loop => (
                            <div key={loop.id} className="loop-item archived">
                                <div className="loop-content">
                                    <p className="loop-text">{loop.content}</p>
                                    <span className="loop-timestamp">
                                        Archived: {new Date(loop.archivedAt!).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeLoops.length === 0 && completedLoops.length === 0 && (!showArchived || archivedLoops.length === 0) && (
                <div className="empty-state">
                    <p>No open loops yet. Add one above to get started!</p>
                </div>
            )}
        </div>
    );
}
