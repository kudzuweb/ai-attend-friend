import { useState, useEffect } from 'react';
import TasklistView from './main-views/TasklistView';
import OpenLoopsView from './main-views/OpenLoopsView';
import JournalView from './main-views/JournalView';
import SettingsView from './main-views/SettingsView';

type MainView = 'openloops' | 'focus' | 'reflection' | 'settings';

export default function MainApp() {
    const [currentView, setCurrentView] = useState<MainView>('openloops');

    // Listen for screenshot capture requests from main process
    useEffect(() => {
        const unsubscribe = window.api.onScreenshotCapture(async () => {
            try {
                const screenshot = await window.api.captureFrames();
                await window.api.reportScreenshotResult({
                    ok: true,
                    dataUrl: screenshot.dataUrl,
                    capturedAt: screenshot.capturedAt
                });
            } catch (e: any) {
                console.error('[MainApp] Screenshot capture failed:', e);
                await window.api.reportScreenshotResult({
                    ok: false,
                    error: e?.message ?? 'capture failed'
                });
            }
        });
        return unsubscribe;
    }, []);

    return (
        <div className="main-app">
            <div className="sidebar">
                <div className="logo">Attend</div>
                <nav>
                    <button
                        className={currentView === 'openloops' ? 'active' : ''}
                        onClick={() => setCurrentView('openloops')}
                    >
                        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        Open Loops
                    </button>
                    <button
                        className={currentView === 'focus' ? 'active' : ''}
                        onClick={() => setCurrentView('focus')}
                    >
                        <div className="nav-icon-target">
                            <div className="target-dot" />
                        </div>
                        Focus
                    </button>
                    <button
                        className={currentView === 'reflection' ? 'active' : ''}
                        onClick={() => setCurrentView('reflection')}
                    >
                        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        Reflections
                    </button>
                </nav>
                <div className="sidebar-footer">
                    <button
                        className={`settings-button ${currentView === 'settings' ? 'active' : ''}`}
                        onClick={() => setCurrentView('settings')}
                        title="Settings"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"></circle>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                        </svg>
                    </button>
                </div>
            </div>

            <div className="main-content">
                {currentView === 'openloops' && <OpenLoopsView />}
                {currentView === 'focus' && <TasklistView />}
                {currentView === 'reflection' && <JournalView />}
                {currentView === 'settings' && <SettingsView />}
            </div>
        </div>
    );
}
