import { useState } from 'react';
import TasklistView from './main-views/TasklistView';

type MainView = 'openloops' | 'tasklist' | 'journal' | 'settings';

export default function MainApp() {
    const [currentView, setCurrentView] = useState<MainView>('tasklist');

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
            </div>

            <div className="main-content">
                {currentView === 'openloops' && <div>Open Loops View (Coming Soon)</div>}
                {currentView === 'tasklist' && <TasklistView />}
                {currentView === 'journal' && <div>Journal View (Coming Soon)</div>}
                {currentView === 'settings' && <div>Settings View (Coming Soon)</div>}
            </div>
        </div>
    );
}
