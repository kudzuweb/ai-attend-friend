import { useState } from "react";

interface DistractedReasonViewProps {
    analysisText: string;
    onComplete: () => void;
    onReflectDeeper: () => void;
}

export default function DistractedReasonView({ analysisText, onComplete, onReflectDeeper }: DistractedReasonViewProps) {
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSessionCompletion(handleOk: () => void) {
        setIsSubmitting(true);

        const res = await window.api.saveDistractionReason(reason);

        if (res.ok) {
            handleOk()
        } else {
            console.error('Failed to save distraction reason:', res.error);
        }

        setIsSubmitting(false);
    }


    async function handleSaveAndEndSession() {
        async function handleOk() {
            // Save and end the session
            setReason('');
            await window.api.sessionStop();
            await window.api.hidePanel();
            onComplete();
        }
        await handleSessionCompletion(handleOk);
    }

    async function handleResumeSession() {
        async function handleOk() {
            setReason('');
            await window.api.hidePanel();
            onComplete();
        }

        if (!reason.trim()) {
            return; // Don't allow deeper reflection without a reason
        }

        await handleSessionCompletion(handleOk)
    }

    async function handleReflectDeeper() {
        async function handleOk() {
            setReason('');
            // Pause the session before opening reflection view
            await window.api.pauseSession();
            onReflectDeeper();
        }

        if (!reason.trim()) {
            return; // Don't allow deeper reflection without a reason
        }

        await handleSessionCompletion(handleOk)
    }

    return (
        <>
            <h2 className="panel-title">Attention Drifting?</h2>

            <div className="content-box" style={{ marginTop: 8, marginBottom: 12 }}>
                {analysisText}
            </div>

            <p style={{ fontSize: 13, marginBottom: 8 }}>
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
