import { useState } from "react";

interface DistractedReasonViewProps {
    analysisText: string;
    onComplete: () => void;
    onReflectDeeper: () => void;
}

export default function DistractedReasonView({ analysisText, onComplete, onReflectDeeper }: DistractedReasonViewProps) {
    const [reason, setReason] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit() {
        setIsSubmitting(true);

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

    async function handleDismiss() {
        setReason('');
        await window.api.hidePanel();
        onComplete();
    }

    return (
        <>
            <h2 className={'panel'} style={{ fontWeight: 600 }}>looks like you got distracted</h2>

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
                What pulled you off-task?
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
                    width: '100%',
                    minHeight: 60,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button
                    className={'panel'}
                    onClick={handleSubmit}
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
                    {isSubmitting ? 'saving...' : 'note it'}
                </button>
                <button
                    className={'panel'}
                    onClick={() => {
                        onReflectDeeper();
                    }}
                    disabled={isSubmitting}
                    style={{
                        background: 'rgba(139, 115, 85, 0.3)',
                        border: '1px solid rgba(139, 115, 85, 0.5)',
                        padding: '8px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                    }}
                >
                    reflect deeper
                </button>
                <button
                    className={'panel'}
                    onClick={handleDismiss}
                    disabled={isSubmitting}
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                    }}
                >
                    dismiss
                </button>
            </div>
        </>
    );
}
