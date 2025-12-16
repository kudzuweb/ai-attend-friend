import { useState, useEffect } from 'react';
import TasklistView from './main-views/TasklistView';
import OpenLoopsView from './main-views/OpenLoopsView';
import JournalView from './main-views/JournalView';
import SettingsView from './main-views/SettingsView';

type MainView = 'openloops' | 'tasklist' | 'journal' | 'settings';

export default function MainApp() {
    const [currentView, setCurrentView] = useState<MainView>('tasklist');

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
                <h2>AI Attend Friend</h2>
                <nav>
                    <button
                        className={currentView === 'openloops' ? 'active' : ''}
                        onClick={() => setCurrentView('openloops')}
                    >
                        Open Loops
                    </button>
                    <button
                        className={currentView === 'tasklist' ? 'active' : ''}
                        onClick={() => setCurrentView('tasklist')}
                    >
                        Tasklist
                    </button>
                    <button
                        className={currentView === 'journal' ? 'active' : ''}
                        onClick={() => setCurrentView('journal')}
                    >
                        Journal
                    </button>
                    <button
                        className={currentView === 'settings' ? 'active' : ''}
                        onClick={() => setCurrentView('settings')}
                    >
                        Settings
                    </button>
                </nav>
                <div className="sidebar-footer">
                    <button
                        className="quit-button"
                        onClick={() => window.api.quitApp()}
                    >
                        Quit
                    </button>
                </div>
            </div>

            <div className="main-content">
                {currentView === 'openloops' && <OpenLoopsView />}
                {currentView === 'tasklist' && <TasklistView />}
                {currentView === 'journal' && <JournalView />}
                {currentView === 'settings' && <SettingsView />}
            </div>
        </div>
    );
}
