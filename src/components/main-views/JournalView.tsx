import { useState, useEffect } from 'react';

export default function JournalView() {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [newEntryContent, setNewEntryContent] = useState('');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'sessions-only' | 'standalone'>('all');

    useEffect(() => {
        loadEntries();
    }, [filterMode]);

    async function loadEntries() {
        let result;
        if (filterMode === 'sessions-only') {
            result = await window.api.getJournalEntries('sessions-only');
        } else {
            result = await window.api.getJournalEntries();
        }

        if (result.ok) {
            let filtered = result.entries;
            if (filterMode === 'standalone') {
                filtered = filtered.filter(e => !e.sessionId);
            }
            // Sort by most recent first
            filtered.sort((a, b) => b.createdAt - a.createdAt);
            setEntries(filtered);
        }
    }

    async function handleAddEntry() {
        if (!newEntryContent.trim()) return;

        const result = await window.api.createJournalEntry({
            content: newEntryContent.trim(),
            sessionId: null,
        });

        if (result.ok) {
            setNewEntryContent('');
            await loadEntries();
        }
    }

    function handleStartEdit(entry: JournalEntry) {
        setEditingEntryId(entry.id);
        setEditingContent(entry.content);
    }

    function handleCancelEdit() {
        setEditingEntryId(null);
        setEditingContent('');
    }

    async function handleSaveEdit(entryId: string) {
        if (!editingContent.trim()) return;

        const result = await window.api.updateJournalEntry(entryId, {
            content: editingContent.trim(),
        });

        if (result.ok) {
            setEditingEntryId(null);
            setEditingContent('');
            await loadEntries();
        }
    }

    async function handleDelete(entryId: string) {
        if (confirm('Delete this journal entry?')) {
            await window.api.deleteJournalEntry(entryId);
            await loadEntries();
        }
    }

    return (
        <div className="journal-view">
            <div className="view-header">
                <h1>Journal</h1>
                <p className="view-description">
                    Record your thoughts, reflections, and insights
                </p>
            </div>

            <div className="add-entry-section">
                <textarea
                    value={newEntryContent}
                    onChange={(e) => setNewEntryContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) handleAddEntry();
                    }}
                    placeholder="Write your thoughts... (⌘+Enter to save)"
                    className="journal-textarea"
                    rows={4}
                />
                <button onClick={handleAddEntry} className="btn-primary">Add Entry</button>
            </div>

            <div className="view-controls">
                <div className="filter-buttons">
                    <button
                        className={filterMode === 'all' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterMode('all')}
                    >
                        All Entries
                    </button>
                    <button
                        className={filterMode === 'sessions-only' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterMode('sessions-only')}
                    >
                        Session Reflections
                    </button>
                    <button
                        className={filterMode === 'standalone' ? 'filter-btn active' : 'filter-btn'}
                        onClick={() => setFilterMode('standalone')}
                    >
                        Standalone
                    </button>
                </div>
            </div>

            <div className="entries-list">
                {entries.length === 0 ? (
                    <div className="empty-state">
                        <p>No journal entries yet. Add your first entry above!</p>
                    </div>
                ) : (
                    entries.map(entry => (
                        <div key={entry.id} className="journal-entry">
                            {editingEntryId === entry.id ? (
                                <div className="entry-edit">
                                    <textarea
                                        value={editingContent}
                                        onChange={(e) => setEditingContent(e.target.value)}
                                        className="journal-textarea"
                                        rows={4}
                                        autoFocus
                                    />
                                    <div className="entry-edit-actions">
                                        <button onClick={() => handleSaveEdit(entry.id)} className="btn-small">
                                            Save
                                        </button>
                                        <button onClick={handleCancelEdit} className="btn-small">
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="entry-header">
                                        <span className="entry-date">
                                            {new Date(entry.createdAt).toLocaleString()}
                                        </span>
                                        {entry.sessionId && (
                                            <span className="entry-badge">Session Reflection</span>
                                        )}
                                    </div>
                                    <p className="entry-content">{entry.content}</p>
                                    {entry.updatedAt !== entry.createdAt && (
                                        <span className="entry-updated">
                                            Updated: {new Date(entry.updatedAt).toLocaleString()}
                                        </span>
                                    )}
                                    <div className="entry-actions">
                                        <button onClick={() => handleStartEdit(entry)} className="btn-small">
                                            Edit
                                        </button>
                                        <button onClick={() => handleDelete(entry.id)} className="btn-small btn-danger">
                                            Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
