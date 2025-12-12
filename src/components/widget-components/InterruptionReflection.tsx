import { useState } from 'react';

interface Props {
    durationMs: number;
    onResume: (reflection: string) => void;
    onEnd: (reflection: string) => void;
}

export default function InterruptionReflection({ durationMs, onResume, onEnd }: Props) {
    const [reflection, setReflection] = useState('');

    const minutes = Math.round(durationMs / 60000);

    function handleResume() {
        onResume(reflection);
    }

    function handleEnd() {
        onEnd(reflection);
    }

    return (
        <div className="interruption-reflection">
            <h2>Welcome Back</h2>
            <p className="interruption-duration">
                You were away for {minutes} minute{minutes !== 1 ? 's' : ''}.
            </p>

            <div className="reflection-input">
                <label htmlFor="reflection-text">
                    What pulled you away? (optional)
                </label>
                <textarea
                    id="reflection-text"
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="I was..."
                    rows={3}
                />
            </div>

            <div className="interruption-actions">
                <button
                    className="btn-resume"
                    onClick={handleResume}
                >
                    Resume Session
                </button>
                <button
                    className="btn-end"
                    onClick={handleEnd}
                >
                    End Session
                </button>
            </div>
        </div>
    );
}
