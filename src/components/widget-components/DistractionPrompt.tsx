import { useState } from 'react';

interface Props {
    analysis: string;
    suggestedPrompt: string;
    onResume: (reason: string) => void;
    onEnd: (reason: string) => void;
}

export default function DistractionPrompt({ analysis, suggestedPrompt, onResume, onEnd }: Props) {
    const [reason, setReason] = useState('');

    function handleResume() {
        onResume(reason);
    }

    function handleEnd() {
        onEnd(reason);
    }

    return (
        <div className="distraction-prompt">
            <h2>Attention Drifting?</h2>
            <p className="distraction-subtext">
                That's okay. Let's understand what happened.
            </p>

            <div className="analysis-box">
                {analysis}
            </div>

            <div className="reflection-input">
                <label htmlFor="distraction-reason">
                    {suggestedPrompt || "What were you feeling just before you drifted?"}
                </label>
                <textarea
                    id="distraction-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="I was feeling..."
                    rows={3}
                />
            </div>

            <div className="distraction-actions">
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
