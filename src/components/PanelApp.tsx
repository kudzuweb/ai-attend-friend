import { useState, useEffect } from "react";
import AnalysisView from "./panel-views/AnalysisView";
import SessionSetupView from "./panel-views/SessionSetupView";
import InterruptionReflectionView from "./panel-views/InterruptionReflectionView";
import DistractedReasonView from "./panel-views/DistractedReasonView";
import DeeperReflectionView from "./panel-views/DeeperReflectionView";

type PanelView = 'analysis' | 'session-setup' | 'interruption-reflection' | 'distracted-reason' | 'deeper-reflection';

export default function PanelApp() {
    const [currentView, setCurrentView] = useState<PanelView>('analysis');
    const [distractedAnalysisText, setDistractedAnalysisText] = useState<string>('');

    // Listen to IPC events for view changes
    useEffect(() => {
        window.api.onSessionSetupRequested(() => {
            setCurrentView('session-setup');
        });

        window.api.onInterruptionReflectionRequested(() => {
            console.log('[PanelApp] onInterruptionReflectionRequested fired!');
            setCurrentView('interruption-reflection');
        });

        window.api.onDistractionReasonRequested((analysisText: string) => {
            console.log('[PanelApp] onDistractionReasonRequested fired!');
            setDistractedAnalysisText(analysisText);
            setCurrentView('distracted-reason');
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
