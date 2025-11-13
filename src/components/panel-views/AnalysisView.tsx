import { useState, useEffect, useRef } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { useSession } from "../../contexts/SessionContext";

export default function AnalysisView() {
    const [llmText, setLlmText] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const intervalRef = useRef<number | null>(null);

    const { settings } = useSettings();
    const { sessionState } = useSession();

    const demoMode = settings?.demoMode ?? true;
    const isSessionActive = Boolean(sessionState?.isActive);

    async function askTheLlm() {
        setLoading(true);

        const res = await window.api.analyzeRecent(10);
        console.log('AnalysisView res:', res);
        if (!res.ok) {
            setLlmText(`error: ${res.error ?? 'unknown'}`);
            setLoading(false);
            return;
        }
        if (!res.structured) {
            console.warn('no text field, raw payload:', res.raw);
        }
        setLlmText(res.structured.analysis);
        setLoading(false);
    }

    // Auto-analysis timer when demo mode is OFF and session is active
    useEffect(() => {
        console.log('[AnalysisView] Auto-analysis check:', { demoMode, isSessionActive });

        // Clear any existing interval
        if (intervalRef.current) {
            console.log('[AnalysisView] Clearing existing interval');
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        // Only start auto-analysis if demo mode is OFF and session is active
        if (!demoMode && isSessionActive) {
            console.log('[AnalysisView] Starting auto-analysis timer (5 minutes)');
            // Set up interval for every 5 minutes (no immediate analysis)
            // For testing: change to 30 * 1000 (30 seconds) or 10 * 1000 (10 seconds)
            const intervalMs = 5 * 60 * 1000; // 5 minutes
            intervalRef.current = setInterval(() => {
                console.log('[AnalysisView] Auto-analysis triggered!');
                askTheLlm();
            }, intervalMs);
            console.log('[AnalysisView] Next auto-analysis in', intervalMs / 1000, 'seconds');
        } else {
            console.log('[AnalysisView] Auto-analysis NOT started - conditions not met');
        }

        // Cleanup on unmount or when dependencies change
        return () => {
            if (intervalRef.current) {
                console.log('[AnalysisView] Cleanup: clearing interval');
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [demoMode, isSessionActive]);

    return (
        <>
            <h2 className="panel-title">Analysis</h2>
            <div className={demoMode ? "flex-row-center gap-8 mb-16" : "flex-row-center mb-16"}>
                {demoMode && (
                    <button className="button-secondary" onClick={askTheLlm}>Analyze last 5 mins</button>
                )}
                <button className="button-secondary" onClick={() => window.api.hidePanel()}>Close</button>
            </div>

            <div className="content-box" style={{ minHeight: 80, maxHeight: 110, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {loading && (
                    demoMode
                        ? 'Ready to analyze'
                        : isSessionActive
                            ? 'Auto-analysis will run every 5 minutes during active session'
                            : 'Start a session to enable auto-analysis'
                )}
                {!loading && llmText}
            </div>

            <textarea
                className="panel-textarea"
                style={{ minHeight: 60 }}
                placeholder="What pulled you off-task?"
            />
        </>
    );
}
