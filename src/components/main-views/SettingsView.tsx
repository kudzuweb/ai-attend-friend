import { useState, useEffect } from 'react';

type Settings = {
    windowPosition: 'top-left' | 'top-center' | 'top-right';
    demoMode: boolean;
    tasksEnabled: boolean;
};

export default function SettingsView() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setLoading(true);
        const result = await window.api.getSettings();
        setSettings(result);
        setLoading(false);
    }

    async function handleToggleDemoMode() {
        if (!settings) return;
        const updated = await window.api.updateSettings({ demoMode: !settings.demoMode });
        setSettings(updated);
    }

    async function handleToggleTasksEnabled() {
        if (!settings) return;
        const updated = await window.api.updateSettings({ tasksEnabled: !settings.tasksEnabled });
        setSettings(updated);
    }

    if (loading || !settings) {
        return (
            <div className="settings-view">
                <h1>Settings</h1>
                <p>Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="settings-view">
            <h1>Settings</h1>

            <section className="settings-section">
                <h2>Session Behavior</h2>

                <div className="setting-item">
                    <div className="setting-toggle">
                        <label className="toggle-label">
                            <span className="toggle-text">Demo Mode</span>
                            <div
                                className={`toggle-switch ${settings.demoMode ? 'active' : ''}`}
                                onClick={handleToggleDemoMode}
                            >
                                <div className="toggle-thumb" />
                            </div>
                        </label>
                    </div>
                    <p className="setting-description">
                        When enabled, auto-analysis is disabled. Use this for testing without AI API calls.
                    </p>
                </div>

                <div className="setting-item">
                    <div className="setting-toggle">
                        <label className="toggle-label">
                            <span className="toggle-text">Show Tasks in Widget</span>
                            <div
                                className={`toggle-switch ${settings.tasksEnabled ? 'active' : ''}`}
                                onClick={handleToggleTasksEnabled}
                            >
                                <div className="toggle-thumb" />
                            </div>
                        </label>
                    </div>
                    <p className="setting-description">
                        Display your task list in the session widget during focus sessions.
                    </p>
                </div>
            </section>

            <section className="settings-section">
                <h2>About</h2>
                <p className="about-text">
                    Attend helps you maintain focus during work sessions through gentle awareness,
                    not surveillance. Built on the philosophy of{' '}
                    <a href="https://attncopilot.com/" target="_blank" rel="noopener noreferrer">
                        Attention Copilot
                    </a>.
                </p>
            </section>
        </div>
    );
}
