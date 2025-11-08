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
            <h2 className="panel-title">Take a Moment</h2>

            <p style={{ fontSize: 14, marginTop: 8, marginBottom: 12 }}>
                How are you feeling right now? What do you think pulled your attention away?
            </p>

            <textarea
                className="panel-textarea"
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="I'm feeling..."
                style={{ minHeight: 100, maxHeight: 150, resize: 'none' }}
            />

            <div className="button-group">
                <button
                    className="button-primary"
                    onClick={handleResumeSession}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Saving...' : 'Resume session'}
                </button>
                <button
                    className="button-secondary"
                    onClick={handleSaveAndEndSession}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Saving...' : 'Save and end session'}
                </button>
            </div>
        </>
    );
}
