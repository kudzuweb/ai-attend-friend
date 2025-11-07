import { useState } from "react";

interface InterruptionReflectionViewProps {
    onResume: () => void;
    onEnd: () => void;
}

export default function InterruptionReflectionView({ onResume, onEnd }: InterruptionReflectionViewProps) {
    const [interruptionReflection, setInterruptionReflection] = useState<string>('');

    async function handleResumeAfterInterruption() {
        console.log('[InterruptionReflectionView] handleResumeAfterInterruption called, reflection:', interruptionReflection);
        const res = await window.api.sessionResumeAfterInterruption(interruptionReflection);
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
        const res = await window.api.sessionEndAfterInterruption(interruptionReflection);
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
            <h2 className={'panel'} style={{ fontWeight: 600 }}>your screen went to sleep</h2>
            <p style={{ fontSize: 14, opacity: 0.8, marginTop: 8 }}>
                What pulled you away?
            </p>
            <textarea
                value={interruptionReflection}
                onChange={(e) => setInterruptionReflection(e.target.value)}
                placeholder="I stepped away for..."
                style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: 'inherit',
                    fontSize: 14,
                    width: '100%',
                    minHeight: 80,
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                <button
                    className={'panel'}
                    onClick={handleResumeAfterInterruption}
                    style={{
                        background: '#8B7355',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: 6,
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    resume session
                </button>
                <button
                    className={'panel'}
                    onClick={handleEndAfterInterruption}
                    style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '8px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                    }}
                >
                    end session
                </button>
            </div>
        </>
    );
}
