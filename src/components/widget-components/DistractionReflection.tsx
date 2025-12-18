import { useState } from 'react';
import type { PromptKey } from './DistractionPrompt';

interface Props {
    reasonType: PromptKey;
    startTime: number;
    onResume: (reflection: string, pauseDurationMs: number) => void;
    onEnd: (reflection: string) => void;
    onOpenInMain: (reflection: string, reasonType: PromptKey) => void;
}

// Deeper reflection prompts for each reason type
const reflectionPrompts: Record<PromptKey, string> = {
    'feeling': "Take a moment to sit with that feeling. What does it want you to know?",
    'need': "Sometimes distraction is a signal. What might you actually need right now?",
    'resistance': "Resistance often points to something important. What's underneath it?",
    'avoidance': "It's okay to avoid sometimes. What would help you feel ready to face it?",
    'pull': "Notice what drew you away. Is there something there worth attending to later?",
};

const placeholders: Record<PromptKey, string> = {
    'feeling': "I notice I was feeling...",
    'need': "What I might need is...",
    'resistance': "The resistance feels like...",
    'avoidance': "I might be avoiding...",
    'pull': "What pulled me was...",
};

const reasonLabels: Record<PromptKey, string> = {
    'feeling': 'Feeling',
    'need': 'Need',
    'resistance': 'Resistance',
    'avoidance': 'Avoidance',
    'pull': 'Pull',
};

export default function DistractionReflection({
    reasonType,
    startTime,
    onResume,
    onEnd,
    onOpenInMain,
}: Props) {
    const [reflection, setReflection] = useState('');

    function formatFullReflection(): string {
        const deeperPrompt = reflectionPrompts[reasonType];
        return `${deeperPrompt}\n\n${reflection}`;
    }

    function handleResume() {
        const pauseDurationMs = Date.now() - startTime;
        onResume(formatFullReflection(), pauseDurationMs);
    }

    function handleEnd() {
        onEnd(formatFullReflection());
    }

    function handleOpenInMain() {
        const formatted = formatFullReflection();
        console.log('[DistractionReflection] handleOpenInMain called');
        console.log('[DistractionReflection] reflection state:', reflection);
        console.log('[DistractionReflection] formatted content:', formatted);
        onOpenInMain(formatted, reasonType);
    }

    return (
        <div className="distraction-reflection">
            <div className="reflection-header">
                <span className="reason-badge">{reasonLabels[reasonType]}</span>
                <h2>Let's explore what happened.</h2>
            </div>

            <p className="reflection-prompt">{reflectionPrompts[reasonType]}</p>

            <div className="reflection-input">
                <textarea
                    value={reflection}
                    onChange={(e) => setReflection(e.target.value)}
                    placeholder={placeholders[reasonType]}
                    rows={4}
                    autoFocus
                />
            </div>

            <div className="reflection-actions">
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

            <button
                className="btn-open-main"
                onClick={handleOpenInMain}
                disabled={!reflection.trim()}
            >
                Open in Reflections
            </button>
        </div>
    );
}
