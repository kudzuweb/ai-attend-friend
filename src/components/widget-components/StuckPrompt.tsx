import { useState } from 'react';

type PromptKey = 'smallest-step' | 'unclear' | 'avoiding';

interface Props {
    onResume: (reflection: string) => void;
    onEnd: () => void;
}

const prompts: Record<PromptKey, string> = {
    'smallest-step': "What's the smallest next step you could take?",
    'unclear': "What's unclear right now?",
    'avoiding': "Is there something you're avoiding looking at?",
};

export default function StuckPrompt({ onResume, onEnd }: Props) {
    const [reflection, setReflection] = useState('');
    const [selectedPrompt, setSelectedPrompt] = useState<PromptKey>('smallest-step');

    function handleResume() {
        onResume(reflection);
    }

    return (
        <div className="stuck-prompt">
            <h2>Feeling Stuck?</h2>
            <p className="stuck-subtext">
                That's okay. Let's work through it.
            </p>

            <div className="prompt-selector">
                {(Object.keys(prompts) as PromptKey[]).map((key) => (
                    <button
                        key={key}
                        className={`prompt-option ${selectedPrompt === key ? 'active' : ''}`}
                        onClick={() => setSelectedPrompt(key)}
                    >
                        {key === 'smallest-step' && 'Smallest step'}
                        {key === 'unclear' && "What's unclear"}
                        {key === 'avoiding' && 'Avoiding something'}
                    </button>
                ))}
            </div>

            <p className="current-prompt">{prompts[selectedPrompt]}</p>

            <div className="reflection-input">
                <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder="Think through it here..."
                    rows={3}
                />
            </div>

            <div className="stuck-actions">
                <button
                    className="btn-resume"
                    onClick={handleResume}
                >
                    Resume Session
                </button>
                <button
                    className="btn-end"
                    onClick={onEnd}
                >
                    End Session
                </button>
            </div>
        </div>
    );
}
