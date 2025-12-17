import { useState, useEffect, useRef } from 'react';

type MainView = 'openloops' | 'focus' | 'reflection' | 'settings';

interface OpenLoopsViewProps {
    onNavigate?: (view: MainView) => void;
}

export default function OpenLoopsView({ onNavigate }: OpenLoopsViewProps) {
    const [loops, setLoops] = useState<OpenLoop[]>([]);
    const [newLoopContent, setNewLoopContent] = useState('');
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpenDropdownId(null);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        loadLoops();
    }, []);

    async function loadLoops() {
        const result = await window.api.getOpenLoops(false);
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

    async function handleDelete(loopId: string) {
        if (confirm('Delete this loop?')) {
            await window.api.deleteOpenLoop(loopId);
            await loadLoops();
        }
    }

    async function handleDeleteSilent(loopId: string) {
        const result = await window.api.deleteOpenLoop(loopId);
        if (result.ok) {
            await loadLoops();
        }
    }

    async function handleUpdateLoop(loopId: string, newContent: string) {
        const result = await window.api.updateOpenLoop(loopId, { content: newContent.trim() });
        if (result.ok) {
            await loadLoops();
        }
    }

    async function handleConvertToTask(loop: OpenLoop) {
        const result = await window.api.createTask({
            content: loop.content,
            parentTaskId: null,
            sourceLoopId: loop.id,
        });

        if (result.ok) {
            await handleDeleteSilent(loop.id);
            onNavigate?.('focus');
        }
        setOpenDropdownId(null);
    }

    async function handleConvertToReflection(loop: OpenLoop) {
        const result = await window.api.createJournalEntry({
            content: loop.content,
            sessionId: null,
            sourceLoopId: loop.id,
        });

        if (result.ok) {
            await handleDeleteSilent(loop.id);
            onNavigate?.('reflection');
        }
        setOpenDropdownId(null);
    }

    const activeLoops = loops.filter(l => !l.archivedAt && !l.completedAt);

    return (
        <div className="openloops-view">
            <div className="view-header">
                <h1>Open Loops</h1>
                <p className="view-description">
                    Capture unfinished tasks, ideas, and fleeting thoughts
                </p>
            </div>

            <div className="unified-card">
                <div className="card-input-row">
                    <textarea
                        value={newLoopContent}
                        onChange={(e) => setNewLoopContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleAddLoop();
                            }
                        }}
                        placeholder="What's on your mind?"
                        className="card-input-lg"
                        rows={1}
                    />
                    <button onClick={handleAddLoop} className="btn-primary">Add</button>
                </div>

                <div className="card-items">
                    {activeLoops.length === 0 ? (
                        <div className="empty-state">
                            <p>All loops closed. Mind is clear.</p>
                        </div>
                    ) : (
                        activeLoops.map(loop => (
                            <div key={loop.id} className="loop-item">
                                <div className="drag-handle" title="Drag to reorder">
                                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                        <line x1="1" y1="3" x2="13" y2="3" />
                                        <line x1="1" y1="7" x2="13" y2="7" />
                                    </svg>
                                </div>
                                <textarea
                                    defaultValue={loop.content}
                                    onBlur={(e) => {
                                        if (e.target.value !== loop.content) {
                                            if (!e.target.value.trim()) {
                                                handleDeleteSilent(loop.id);
                                            } else {
                                                handleUpdateLoop(loop.id, e.target.value);
                                            }
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            e.currentTarget.blur();
                                        }
                                    }}
                                    rows={1}
                                    className="loop-inline-input"
                                />
                                <div className="loop-actions">
                                    <div className="convert-dropdown" ref={openDropdownId === loop.id ? dropdownRef : null}>
                                        <button
                                            onClick={() => setOpenDropdownId(openDropdownId === loop.id ? null : loop.id)}
                                            className="btn-icon btn-convert-arrow"
                                            title="Convert"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12" />
                                                <polyline points="12 5 19 12 12 19" />
                                            </svg>
                                        </button>
                                        {openDropdownId === loop.id && (
                                            <div className="convert-dropdown-menu">
                                                <button onClick={() => handleConvertToTask(loop)}>
                                                    Task
                                                </button>
                                                <button onClick={() => handleConvertToReflection(loop)}>
                                                    Reflection
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDelete(loop.id)}
                                        className="btn-icon"
                                        title="Delete"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
