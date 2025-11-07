import { useState, useEffect } from "react";
import AnalysisView from "./panel-views/AnalysisView";
import SessionSetupView from "./panel-views/SessionSetupView";
import InterruptionReflectionView from "./panel-views/InterruptionReflectionView";

type PanelView = 'analysis' | 'session-setup' | 'interruption-reflection';

export default function PanelApp() {
    const [currentView, setCurrentView] = useState<PanelView>('analysis');

    // Listen to IPC events for view changes
    useEffect(() => {
        window.api.onSessionSetupRequested(() => {
            setCurrentView('session-setup');
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
