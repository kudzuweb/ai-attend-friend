import { useState } from "react";

export default function AnalysisView() {
    const [llmText, setLlmText] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <>
            <h2 className="panel-title">Analysis</h2>
            <div className="flex-row-center gap-8 mb-16">
                <button className="button-secondary" onClick={askTheLlm}>Analyze last 5 mins</button>
                <button className="button-secondary" onClick={() => window.api.hidePanel()}>Close</button>
            </div>

            <div className="content-box" style={{ minHeight: 80, maxHeight: 110, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {loading && 'Ready to analyze'}
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
