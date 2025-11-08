import { useState } from "react";

interface DistractedReasonViewProps {
    analysisText: string;
    onComplete: () => void;
    onReflectDeeper: () => void;
}

export default function DistractedReasonView({ analysisText, onComplete, onReflectDeeper }: DistractedReasonViewProps) {
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSaveAndEndSession() {
        setIsSubmitting(true);

        const res = await window.api.saveDistractionReason(reason);

        if (res.ok) {
            // End the session
            await window.api.sessionStop();
            setReason('');
            await window.api.hidePanel();
            onComplete();
        } else {
            console.error('Failed to save distraction reason:', res.error);
        }

        setIsSubmitting(false);
    }

    async function handleResumeSession() {
        if (!reason.trim()) {
            return; // Don't allow resume without a reason
        }

        setIsSubmitting(true);

        // Save the reason first
        const res = await window.api.saveDistractionReason(reason);

        if (res.ok) {
            setReason('');
            await window.api.hidePanel();
            onComplete();
        } else {
            console.error('Failed to save distraction reason:', res.error);
        }

        setIsSubmitting(false);
    }

    async function handleReflectDeeper() {
        if (!reason.trim()) {
            return; // Don't allow deeper reflection without a reason
        }

        setIsSubmitting(true);

        // Save the reason first
        const res = await window.api.saveDistractionReason(reason);

        if (res.ok) {
            setReason('');
            // Pause the session before opening reflection view
            await window.api.pauseSession();
            onReflectDeeper();
        } else {
            console.error('Failed to save distraction reason:', res.error);
        }

        setIsSubmitting(false);
    }

    return (
        <>
            <h2 className="panel-title">Attention Drifting?</h2>

            <div className="content-box" style={{ marginTop: 8, marginBottom: 12 }}>
                {analysisText}
            </div>

            <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                What pulled you off-task? <span className="helper-text">(required)</span>
            </p>

            <textarea
                className="panel-textarea"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="I got distracted by..."
                style={{ minHeight: 60, maxHeight: 85, resize: 'none' }}
            />

            <div className="button-group">
                <button
                    className={reason.trim() ? 'button-primary' : 'button-secondary'}
                    onClick={handleSaveAndEndSession}
                    disabled={isSubmitting || !reason.trim()}
                >
                    {isSubmitting ? 'Saving...' : 'Save and end session'}
                </button>
                <div className="button-row-equal">
                    <button
                        className="button-secondary"
                        onClick={handleResumeSession}
                        disabled={isSubmitting || !reason.trim()}
                    >
                        {isSubmitting ? 'Saving...' : 'Resume session'}
                    </button>
                    <button
                        className="button-secondary"
                        onClick={handleReflectDeeper}
                        disabled={isSubmitting || !reason.trim()}
                    >
                        {isSubmitting ? 'Saving...' : 'Reflect deeper'}
                    </button>
                </div>
            </div>
        </>
    );
}
