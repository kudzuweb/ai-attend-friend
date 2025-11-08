import { useState } from "react";

interface InterruptionReflectionViewProps {
    onResume: () => void;
    onEnd: () => void;
}

export default function InterruptionReflectionView({ onResume, onEnd }: InterruptionReflectionViewProps) {
    const [interruptionReflection, setInterruptionReflection] = useState<string>('');

    async function handleResumeAfterInterruption() {
        console.log('[InterruptionReflectionView] handleResumeAfterInterruption called, reflection:', interruptionReflection);
        const res = await window.api.handleInterruption('resume', interruptionReflection);
        console.log('[InterruptionReflectionView] Resume result:', res);
        if (res.ok) {
            setInterruptionReflection('');
            onResume();
        } else {
            console.error('Failed to resume session:', res.error);
        }
    }

    async function handleEndAfterInterruption() {
        console.log('[InterruptionReflectionView] handleEndAfterInterruption called, reflection:', interruptionReflection);
        const res = await window.api.handleInterruption('end', interruptionReflection);
        console.log('[InterruptionReflectionView] End result:', res);
        if (res.ok) {
            setInterruptionReflection('');
            await window.api.hidePanel();
            onEnd();
        } else {
            console.error('Failed to end session:', res.error);
        }
    }

    return (
        <>
            <h2 className="panel-title">Session Paused</h2>
            <p style={{ fontSize: 14, marginTop: 8, marginBottom: 12 }}>
                What pulled you away?
            </p>
            <textarea
                className="panel-textarea"
                value={interruptionReflection}
                onChange={(e) => setInterruptionReflection(e.target.value)}
                placeholder="I stepped away for..."
                style={{ minHeight: 80 }}
            />
            <div className="button-group">
                <button className="button-primary" onClick={handleResumeAfterInterruption}>
                    Resume session
                </button>
                <button className="button-secondary" onClick={handleEndAfterInterruption}>
                    End session
                </button>
            </div>
        </>
    );
}
