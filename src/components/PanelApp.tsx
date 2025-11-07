import { useState, useEffect } from "react";
import AnalysisView from "./panel-views/AnalysisView";
import SessionSetupView from "./panel-views/SessionSetupView";
import InterruptionReflectionView from "./panel-views/InterruptionReflectionView";
import SettingsView from "./panel-views/SettingsView";
import TasksView from "./panel-views/TasksView";
import DistractedReasonView from "./panel-views/DistractedReasonView";
import DeeperReflectionView from "./panel-views/DeeperReflectionView";

type PanelView = 'analysis' | 'session-setup' | 'interruption-reflection' | 'settings' | 'tasks' | 'distracted-reason' | 'deeper-reflection';

export default function PanelApp() {
    const [currentView, setCurrentView] = useState<PanelView>('analysis');
    const [distractedAnalysisText, setDistractedAnalysisText] = useState<string>('');

    // Listen to unified view change events
    useEffect(() => {
        window.api.onViewChangeRequested((payload) => {
            console.log('[PanelApp] onViewChangeRequested fired:', payload);

            // Handle view changes
            setCurrentView(payload.view);

            // Handle additional data if needed
            if (payload.view === 'distracted-reason' && payload.data) {
                setDistractedAnalysisText(payload.data);
            }
        });
    }, []);

    // Listen for session state changes and navigate away from tasks view if session ends
    useEffect(() => {
        window.api.onSessionUpdated((state) => {
            // If session becomes inactive, go back to analysis view
            if (!state.isActive && currentView === 'tasks') {
                setCurrentView('analysis');
            }
        });
    }, [currentView]);

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
            case 'distracted-reason':
                return (
                    <DistractedReasonView
                        analysisText={distractedAnalysisText}
                        onComplete={() => setCurrentView('analysis')}
                        onReflectDeeper={() => setCurrentView('deeper-reflection')}
                    />
                );
            case 'deeper-reflection':
                return (
                    <DeeperReflectionView
                        onComplete={() => setCurrentView('analysis')}
                    />
                );
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
