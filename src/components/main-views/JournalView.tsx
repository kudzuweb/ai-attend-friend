import { useState, useEffect, useMemo } from 'react';

const reflectionPrompts = [
    "What's present for you right now?",
    "Pause. What do you notice?",
    "Let your thoughts flow...",
    "What would you like to remember?",
    "Take a breath. What's here?",
];

export default function JournalView() {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [newEntryContent, setNewEntryContent] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'sessions-only' | 'standalone'>('all');

    const randomPlaceholder = useMemo(() =>
        reflectionPrompts[Math.floor(Math.random() * reflectionPrompts.length)],
    []);

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

    async function handleUpdateEntry(entryId: string, newContent: string) {
        const result = await window.api.updateJournalEntry(entryId, {
            content: newContent.trim(),
        });

        if (result.ok) {
            await loadEntries();
        }
    }

    async function handleDelete(entryId: string) {
        if (confirm('Delete this journal entry?')) {
            await window.api.deleteJournalEntry(entryId);
            await loadEntries();
        }
    }

    async function handleDeleteSilent(entryId: string) {
        const result = await window.api.deleteJournalEntry(entryId);
        if (result.ok) {
            await loadEntries();
        }
    }

    return (
        <div className="journal-view">
            <div className="view-header">
                <h1>Reflections</h1>
                <p className="view-description">
                    Review your session logs and insights
                </p>
            </div>

            <div className="add-entry-section">
                <textarea
                    value={newEntryContent}
                    onChange={(e) => setNewEntryContent(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.metaKey) handleAddEntry();
                    }}
                    placeholder={randomPlaceholder}
                    className="journal-textarea"
                    rows={4}
                />
                <button onClick={handleAddEntry} className="btn-primary" disabled={!newEntryContent.trim()}>Save Entry</button>
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
                            <div className="entry-row">
                                <textarea
                                    defaultValue={entry.content}
                                    onBlur={(e) => {
                                        if (e.target.value !== entry.content) {
                                            if (!e.target.value.trim()) {
                                                handleDeleteSilent(entry.id);
                                            } else {
                                                handleUpdateEntry(entry.id, e.target.value);
                                            }
                                        }
                                    }}
                                    className="entry-textarea"
                                    rows={2}
                                />
                                <button
                                    onClick={() => handleDelete(entry.id)}
                                    className="btn-icon btn-icon-danger"
                                    title="Delete"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    </svg>
                                </button>
                            </div>
                            {entry.sessionId && (
                                <span className="entry-badge">Session Reflection</span>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
