import { useState, useMemo } from 'react';

type PromptKey = 'feeling' | 'need' | 'resistance' | 'avoidance' | 'pull';

interface Props {
    onResume: (reason: string) => void;
    onEnd: (reason: string) => void;
}

const curatedPrompts: Record<PromptKey, string> = {
    'feeling': "What were you feeling just before you drifted?",
    'need': "What need was this activity meeting?",
    'resistance': "What's making the focus goal feel hard right now?",
    'avoidance': "Was there something you were avoiding?",
    'pull': "What pulled your attention away?",
};

const promptLabels: Record<PromptKey, string> = {
    'feeling': 'Feeling',
    'need': 'Need',
    'resistance': 'Resistance',
    'avoidance': 'Avoidance',
    'pull': 'Pull',
};

const promptKeys = Object.keys(curatedPrompts) as PromptKey[];

export default function DistractionPrompt({ onResume, onEnd }: Props) {
    // Pick a random prompt on mount
    const initialPrompt = useMemo(() => {
        return promptKeys[Math.floor(Math.random() * promptKeys.length)];
    }, []);

    const [reason, setReason] = useState('');
    const [selectedPrompt, setSelectedPrompt] = useState<PromptKey>(initialPrompt);

    function getPromptText(): string {
        return curatedPrompts[selectedPrompt];
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
