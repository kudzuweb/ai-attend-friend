import { useState, useEffect } from "react";
import AnalysisView from "./panel-views/AnalysisView";
import SessionSetupView from "./panel-views/SessionSetupView";
import InterruptionReflectionView from "./panel-views/InterruptionReflectionView";
import SettingsView from "./panel-views/SettingsView";
import TasksView from "./panel-views/TasksView";

type PanelView = 'analysis' | 'session-setup' | 'interruption-reflection' | 'settings' | 'tasks';

export default function PanelApp() {
    const [currentView, setCurrentView] = useState<PanelView>('analysis');

    // Listen to IPC events for view changes
    useEffect(() => {
        window.api.onSessionSetupRequested(() => {
            setCurrentView('session-setup');
        });

        window.api.onSettingsRequested(() => {
            console.log('[PanelApp] onSettingsRequested fired!');
            setCurrentView('settings');
        });

        window.api.onTasksViewRequested(() => {
            console.log('[PanelApp] onTasksViewRequested fired!');
            setCurrentView('tasks');
        });

        window.api.onInterruptionReflectionRequested(() => {
            console.log('[PanelApp] onInterruptionReflectionRequested fired!');
            setCurrentView('interruption-reflection');
        });
    }, []);

    function renderView() {
        switch (currentView) {
            case 'interruption-reflection':
                return (
                    <InterruptionReflectionView
                        onResume={() => setCurrentView('analysis')}
                        onEnd={() => setCurrentView('analysis')}
                    />
                );
            case 'session-setup':
                return (
                    <SessionSetupView
                        onComplete={() => setCurrentView('analysis')}
                        onCancel={() => setCurrentView('analysis')}
                    />
                );
            case 'settings':
                return (
                    <SettingsView
                        onClose={() => setCurrentView('analysis')}
                    />
                );
            case 'tasks':
                return <TasksView />;
            case 'analysis':
                return <AnalysisView />;
        }
    }

    return (
        <div className={'panel-root'}>
            {renderView()}
        </div>
    );
}
