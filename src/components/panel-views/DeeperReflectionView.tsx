import { useState, useEffect } from "react";

interface DeeperReflectionViewProps {
    onComplete: () => void;
}

export default function DeeperReflectionView({ onComplete }: DeeperReflectionViewProps) {
    const [reflection, setReflection] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Pause session when this view opens
    useEffect(() => {
        window.api.pauseSession();
    }, []);

    async function handleResumeSession() {
        setIsSubmitting(true);

        const res = await window.api.handleReflection('resume', reflection);

        if (res.ok) {
            setReflection('');
            await window.api.hidePanel();
            onComplete();
        } else {
            console.error('Failed to save reflection and resume:', res.error);
        }

        setIsSubmitting(false);
    }

    async function handleSaveAndEndSession() {
        setIsSubmitting(true);

        const res = await window.api.handleReflection('end', reflection);

        if (res.ok) {
            setReflection('');
            await window.api.hidePanel();
            onComplete();
        } else {
            console.error('Failed to save reflection and end session:', res.error);
        }

        setIsSubmitting(false);
    }

    return (
        <>
            <h2 className={'panel'} style={{ fontWeight: 600 }}>take a moment</h2>

            <p style={{ fontSize: 14, opacity: 0.8, marginTop: 8, marginBottom: 12 }}>
                How are you feeling right now? What do you think pulled your attention away?
            </p>

            <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="I'm feeling..."
                style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: 'inherit',
                    fontSize: 14,
                    lineHeight: 1.5,
                    width: '100%',
                    minHeight: 100,
                    maxHeight: 150,
                    boxSizing: 'border-box',
                    resize: 'none',
                    fontFamily: 'inherit',
                    overflowY: 'auto',
                }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button
                    className={'panel'}
                    onClick={handleResumeSession}
                    disabled={isSubmitting}
                    style={{
                        background: '#8B7355',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 6,
                        color: 'white',
                        fontWeight: 600,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        opacity: isSubmitting ? 0.5 : 1,
                    }}
                >
                    {isSubmitting ? 'saving...' : 'resume session'}
                </button>
                <button
                    className={'panel'}
                    onClick={handleSaveAndEndSession}
                    disabled={isSubmitting}
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        borderRadius: 6,
                        cursor: isSubmitting ? 'not-allowed' : 'pointer',
                        opacity: isSubmitting ? 0.5 : 1,
                    }}
                >
                    {isSubmitting ? 'saving...' : 'save and end session'}
                </button>
            </div>
        </>
    );
}
