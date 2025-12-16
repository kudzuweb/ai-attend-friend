import { useState } from 'react';

type PromptKey = 'ai-suggested' | 'feeling' | 'need' | 'resistance';

interface Props {
    reflectionPrompt: string;
    onResume: (reason: string) => void;
    onEnd: (reason: string) => void;
}

const fallbackPrompts: Record<Exclude<PromptKey, 'ai-suggested'>, string> = {
    'feeling': "What were you feeling just before you drifted?",
    'need': "What need was this activity meeting?",
    'resistance': "What's making the focus goal feel hard right now?",
};

const promptLabels: Record<PromptKey, string> = {
    'ai-suggested': 'AI insight',
    'feeling': 'Feeling',
    'need': 'Need',
    'resistance': 'Resistance',
};

export default function DistractionPrompt({ reflectionPrompt, onResume, onEnd }: Props) {
    const [reason, setReason] = useState('');
    const [selectedPrompt, setSelectedPrompt] = useState<PromptKey>('ai-suggested');

    function getPromptText(): string {
        if (selectedPrompt === 'ai-suggested') {
            return reflectionPrompt || fallbackPrompts.feeling;
        }
        return fallbackPrompts[selectedPrompt];
    }

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

            <div className="prompt-selector">
                {(Object.keys(promptLabels) as PromptKey[]).map((key) => (
                    <button
                        key={key}
                        className={`prompt-option ${selectedPrompt === key ? 'active' : ''}`}
                        onClick={() => setSelectedPrompt(key)}
                    >
                        {promptLabels[key]}
                    </button>
                ))}
            </div>

            <p className="current-prompt">{getPromptText()}</p>

            <div className="reflection-input">
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
