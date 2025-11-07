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
            <h2 className={'panel'} style={{ fontWeight: 600 }}>Attention drifting?</h2>

            <div
                style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 13,
                    opacity: 0.9,
                    marginTop: 8,
                    marginBottom: 12,
                }}
            >
                {analysisText}
            </div>

            <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 8 }}>
                What pulled you off-task? <span style={{ fontSize: 12, opacity: 0.6 }}>(required)</span>
            </p>

            <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="I got distracted by..."
                style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: 'inherit',
                    fontSize: 14,
                    lineHeight: 1.5,
                    width: '100%',
                    minHeight: 60,
                    maxHeight: 85,
                    boxSizing: 'border-box',
                    resize: 'none',
                    fontFamily: 'inherit',
                    overflowY: 'auto',
                }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button
                    className={'panel'}
                    onClick={handleSaveAndEndSession}
                    disabled={isSubmitting || !reason.trim()}
                    style={{
                        background: reason.trim() ? '#8B7355' : 'rgba(0,0,0,0.3)',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 6,
                        color: 'white',
                        fontWeight: 600,
                        cursor: reason.trim() ? 'pointer' : 'not-allowed',
                        opacity: reason.trim() ? 1 : 0.5,
                    }}
                >
                    {isSubmitting ? 'saving...' : 'save and end session'}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className={'panel'}
                        onClick={handleResumeSession}
                        disabled={isSubmitting || !reason.trim()}
                        style={{
                            flex: 1,
                            background: reason.trim() ? 'rgba(139, 115, 85, 0.4)' : 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(139, 115, 85, 0.6)',
                            padding: '8px 12px',
                            borderRadius: 6,
                            cursor: reason.trim() ? 'pointer' : 'not-allowed',
                            opacity: reason.trim() ? 1 : 0.5,
                            fontSize: 13,
                        }}
                    >
                        {isSubmitting ? 'saving...' : 'resume session'}
                    </button>
                    <button
                        className={'panel'}
                        onClick={handleReflectDeeper}
                        disabled={isSubmitting || !reason.trim()}
                        style={{
                            flex: 1,
                            background: reason.trim() ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            padding: '8px 12px',
                            borderRadius: 6,
                            cursor: reason.trim() ? 'pointer' : 'not-allowed',
                            opacity: reason.trim() ? 1 : 0.5,
                            fontSize: 13,
                        }}
                    >
                        {isSubmitting ? 'saving...' : 'reflect deeper'}
                    </button>
                </div>
            </div>
        </>
    );
}
