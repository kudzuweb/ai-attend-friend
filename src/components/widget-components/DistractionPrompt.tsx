export type PromptKey = 'feeling' | 'need' | 'resistance' | 'avoidance' | 'pull';

interface Props {
    onReasonSelected: (reasonType: PromptKey) => void;
}

export const curatedPrompts: Record<PromptKey, string> = {
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

export default function DistractionPrompt({ onReasonSelected }: Props) {
    function handleReasonClick(key: PromptKey) {
        onReasonSelected(key);
    }

    return (
        <div className="distraction-prompt">
            <h2>Attention Drifting?</h2>
            <p className="distraction-subtext">
                That's okay. Let's understand what happened.
            </p>

            <p className="prompt-instruction">What drew you away?</p>

            <div className="prompt-selector">
                {(Object.keys(promptLabels) as PromptKey[]).map((key) => (
                    <button
                        key={key}
                        className="prompt-option"
                        onClick={() => handleReasonClick(key)}
                    >
                        {promptLabels[key]}
                    </button>
                ))}
            </div>
        </div>
    );
}
