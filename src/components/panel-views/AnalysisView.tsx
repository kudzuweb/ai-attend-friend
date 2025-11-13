import { useState, useEffect, useRef } from "react";

export default function AnalysisView() {
    const [llmText, setLlmText] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [demoMode, setDemoMode] = useState<boolean>(true);
    const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
    const intervalRef = useRef<number | null>(null);

    // Load demo mode from localStorage
    useEffect(() => {
        const savedDemo = localStorage.getItem('demoMode');
        if (savedDemo !== null) {
            const mode = JSON.parse(savedDemo);
            console.log('[AnalysisView] Initial demo mode:', mode);
            setDemoMode(mode);
        }

        // Listen for storage changes
        const handleStorageChange = () => {
            const savedDemo = localStorage.getItem('demoMode');
            if (savedDemo !== null) {
                const mode = JSON.parse(savedDemo);
                console.log('[AnalysisView] Demo mode changed to:', mode);
                setDemoMode(mode);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Track session state
    useEffect(() => {
        async function loadSessionState() {
            try {
                const sessionState = await window.api.sessionGetState();
                console.log('[AnalysisView] Initial session state:', sessionState);
                setIsSessionActive(sessionState.isActive || false);
            } catch (error) {
                console.error('[AnalysisView] Error loading session state:', error);
            }
        }

        loadSessionState();

        // Listen for session updates
        window.api.onSessionUpdated((state) => {
            console.log('[AnalysisView] Session updated:', { isActive: state.isActive });
            setIsSessionActive(state.isActive || false);
        });
    }, []);

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
            console.log('🎬 [DEMO MODE] Starting auto-analysis timer (1 MINUTE INTERVAL)');
            // Set up interval for every 1 minute (no immediate analysis)
            // For testing: change to 30 * 1000 (30 seconds) or 10 * 1000 (10 seconds)
            const intervalMs = 1 * 60 * 1000; // 1 minute
            intervalRef.current = setInterval(() => {
                console.log('🎬 [DEMO MODE] Auto-analysis triggered at 1-minute mark!');
                askTheLlm();
            }, intervalMs);
            console.log('🎬 [DEMO MODE] Next auto-analysis in', intervalMs / 1000, 'seconds (60s)');
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
                            ? 'Auto-analysis will run every 1 minute during active session'
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
