import { useState } from "react";
import { useSettings } from "../../contexts/SettingsContext";
import { useSession } from "../../contexts/SessionContext";

export default function AnalysisView() {
    const [llmText, setLlmText] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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

    // Note: Auto-analysis timer is now handled by SessionManager in the main process

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
