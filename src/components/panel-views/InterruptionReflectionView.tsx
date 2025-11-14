import { useState } from "react";

interface InterruptionReflectionViewProps {
    onResume: () => void;
    onEnd: () => void;
}

export default function InterruptionReflectionView({ onResume, onEnd }: InterruptionReflectionViewProps) {
    const [interruptionReflection, setInterruptionReflection] = useState<string>('');

    async function handleSaveAndAction(handleOk: () => void, action: 'resume' | 'end') {
        console.log('[InterruptionReflectionView]', action, 'called, reflection:', interruptionReflection);
        const res = await window.api.handleInterruption(action, interruptionReflection);
        console.log('[InterruptionReflectionView]', action, 'called, result:', res);
        if (res.ok) {
            handleOk();
        } else {
            console.error('Failed to', action, 'session:', res.error);
        }
    }

    async function handleResumeAfterInterruption() {
        async function handleOk() {
            setInterruptionReflection('');
            onResume();
        }

        await handleSaveAndAction(handleOk, 'resume');
    }

    async function handleEndAfterInterruption() {
        async function handleOk() {
            setInterruptionReflection('');
            await window.api.hidePanel();
            onEnd();
        }

        await handleSaveAndAction(handleOk, 'end')
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
