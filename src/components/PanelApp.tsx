import { useState, useEffect, useRef } from "react";

export default function PanelApp() {
    // session setup state
    const [inSessionSetup, setInSessionSetup] = useState(false);
    // interruption reflection state
    const [showInterruptionReflection, setShowInterruptionReflection] = useState(false);
    const [interruptionReflection, setInterruptionReflection] = useState<string>('');
    // refs
    const dialRef = useRef<HTMLDivElement>(null);

    // session state
    const [sessionState, setSessionState] = useState<SessionState | null>(null);
    // duration selection state
    const [selectedDuration, setSelectedDuration] = useState<number>(25 * 60 * 1000); // 25 mins default
    // focus goal state
    const [focusGoal, setFocusGoal] = useState<string>('');
    // llm output
    const [llmText, setLlmText] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // listen to session state updates and session setup requests
    useEffect(() => {
        window.api.onSessionUpdated((state) => {
            setSessionState(state);
        });

        window.api.onSessionSetupRequested(() => {
            setInSessionSetup(true);
        });

        window.api.onInterruptionReflectionRequested(() => {
            console.log('[PanelApp] onInterruptionReflectionRequested fired!');
            setShowInterruptionReflection(true);
            console.log('[PanelApp] showInterruptionReflection set to true');
        });

        // get initial session state
        window.api.sessionGetState().then(setSessionState).catch(console.error);
    }, []);

    async function handleStartSession() {
        const res = await window.api.sessionStart(selectedDuration, focusGoal);
        if (res.ok) {
            // Reset session setup state
            setInSessionSetup(false);
            setFocusGoal('');
            // Panel will close automatically - this is handled via the session state listener
            await window.api.hidePanel();
        } else {
            console.error('Failed to start session:', res.error);
        }
    }

    async function askTheLlm() {
        setLoading(true);

        const res = await window.api.analyzeRecent(10);
        console.log('panelApp res:', res)
        if (!res.ok) {
            setLlmText(`error: ${res.error ?? 'unknown'}`);
            setLoading(false);
            return;
        }
        if (!res.structured) {
            console.warn('no text field, raw payload:', res.raw)
        }
        setLlmText(res.structured.analysis);
        setLoading(false);
    }

    // Convert selectedDuration (in ms) to minutes for display
    const durationMinutes = selectedDuration / (60 * 1000);

    const handleDurationChange = (minutes: number) => {
        setSelectedDuration(Math.max(1, minutes) * 60 * 1000); // at least 1 minute
    };

    // Handle resuming session after interruption
    async function handleResumeAfterInterruption() {
        console.log('[PanelApp] handleResumeAfterInterruption called, reflection:', interruptionReflection);
        const res = await window.api.sessionResumeAfterInterruption(interruptionReflection);
        console.log('[PanelApp] Resume result:', res);
        if (res.ok) {
            setShowInterruptionReflection(false);
            setInterruptionReflection('');
        } else {
            console.error('Failed to resume session:', res.error);
        }
    }

    // Handle ending session after interruption
    async function handleEndAfterInterruption() {
        console.log('[PanelApp] handleEndAfterInterruption called, reflection:', interruptionReflection);
        const res = await window.api.sessionEndAfterInterruption(interruptionReflection);
        console.log('[PanelApp] End result:', res);
        if (res.ok) {
            setShowInterruptionReflection(false);
            setInterruptionReflection('');
            await window.api.hidePanel();
        } else {
            console.error('Failed to end session:', res.error);
        }
    }

    // Set up non-passive wheel listener for the dial
    useEffect(() => {
        const dial = dialRef.current;
        if (!dial) return;

        const handleWheel = (e: WheelEvent) => {
            // Only intercept scroll if cursor is over the dial element
            if (dial.dataset.active === 'true') {
                e.preventDefault();
                const direction = e.deltaY < 0 ? 1 : -1;
                handleDurationChange(Math.max(1, durationMinutes + direction));
            }
        };

        // Add non-passive listener so preventDefault() works
        dial.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            dial.removeEventListener('wheel', handleWheel);
        };
    }, [durationMinutes]);

    return (
        <>
            <div className={'panel-root'}>
                {showInterruptionReflection ? (
                    // Interruption reflection UI
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
                ) : inSessionSetup ? (
                    // Session setup UI
                    <>
                        <h2 className={'panel'} style={{ fontWeight: 600 }}>new session</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                <label style={{ fontSize: 14 }}>duration</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <button
                                        onClick={() => handleDurationChange(Math.max(1, durationMinutes - 1))}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            fontSize: 20,
                                            background: 'rgba(0,0,0,0.2)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        −
                                    </button>
                                    <div
                                        ref={dialRef}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.dataset.active = 'true';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.dataset.active = 'false';
                                        }}
                                        style={{
                                            minWidth: 80,
                                            textAlign: 'center',
                                            fontSize: 32,
                                            fontWeight: 600,
                                            cursor: 'ns-resize',
                                        }}
                                    >
                                        {Math.round(durationMinutes)}
                                    </div>
                                    <button
                                        onClick={() => handleDurationChange(durationMinutes + 1)}
                                        style={{
                                            width: 40,
                                            height: 40,
                                            fontSize: 20,
                                            background: 'rgba(0,0,0,0.2)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            color: 'inherit',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                                <span style={{ fontSize: 12, opacity: 0.7 }}>minutes</span>
                            </div>
                            <input
                                type="text"
                                value={focusGoal}
                                onChange={(e) => setFocusGoal(e.target.value)}
                                placeholder="What would you like to focus on?"
                                style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 6,
                                    padding: '10px 12px',
                                    color: 'inherit',
                                    fontSize: 14,
                                    width: '100%',
                                    boxSizing: 'border-box',
                                }}
                            />
                            <button
                                className={'panel'}
                                onClick={handleStartSession}
                                style={{
                                    background: '#8B7355',
                                    border: 'none',
                                    padding: '10px 16px',
                                    borderRadius: 6,
                                    color: 'white',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    marginTop: 8,
                                }}
                            >
                                start session
                            </button>
                            <button
                                className={'panel'}
                                onClick={() => {
                                    setInSessionSetup(false);
                                    setFocusGoal('');
                                    window.api.hidePanel();
                                }}
                                style={{
                                    background: 'rgba(0,0,0,0.2)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '8px 16px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                }}
                            >
                                cancel
                            </button>
                        </div>
                    </>
                ) : (
                    // Analysis UI
                    <>
                        <h2 className={'panel'} style={{ fontWeight: 600 }}>analysis</h2>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className={'panel'} onClick={askTheLlm}>analyze last 5 mins</button>
                                <button className={'panel'} onClick={() => window.api.hidePanel()}>close</button>
                            </div>
                        </div>

                        <div
                            style={{
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: 8,
                                minHeight: 80,
                                maxHeight: 110,
                                overflowY: 'auto',
                                padding: 6,
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {loading && 'ready to analyze'}
                            {!loading && llmText}
                        </div>

                        <textarea
                            style={{
                                background: 'rgba(0,0,0,0.2)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                minHeight: 60,
                                color: '#322820',
                                padding: 6,
                            }}
                            placeholder="what pulled you off-task?"
                        />
                    </>
                )}
            </div>
        </>

    );
}
