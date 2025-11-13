import { useState, useCallback, useEffect, useRef } from 'react'
import { WidgetShell } from './widgetshell';

export default function WidgetApp() {
    // state to:
    // hold screenshot
    const [img, setImg] = useState<string | null>(null);
    // perms status
    const [showPermModal, setShowPermModal] = useState(false);
    // session state
    const [sessionState, setSessionState] = useState<SessionState | null>(null);
    // capture timer
    const timerRef = useRef<number | null>(null);
    const capturingRef = useRef(false);

    // capture handler
    const grab = useCallback(async () => {
        // lock to prevent overlapping captures w/o re-render
        if (capturingRef.current) return;
        capturingRef.current = true;

        try {
            console.log('capturing screenshot...');
            // check perms - DISABLED FOR DEMO
            // const permsStatus = await window.api.getScreenPermissionStatus();
            // if (permsStatus !== 'granted') {
            //     setShowPermModal(true);
            //     return;
            // }
            // capture one frame
            const shot: Screenshot = await window.api.captureFrames();
            setImg(shot.dataUrl);
            // send frame back to main process via IPC(once storage is implemented)
            const res = await window.api.saveImage({
                dataUrl: shot.dataUrl,
                capturedAt: shot.capturedAt,
            });
            if (res.ok) {
                console.log('saved:', res.file, '(deduped:', res.deduped, ', bytes:', res.bytes, ')');
            } else {
                console.error('save failed:', res.error);
            }

        }
        catch (e) {
            console.error('capture error:', e);
        }
        finally {
            capturingRef.current = false;
        }
    }, [])  // grab doesn't depend on any props/state, safe to use empty dependency array
    // useEffects
    // listen to session state updates
    useEffect(() => {
        window.api.onSessionUpdated((state) => {
            setSessionState(state);
        });

        // get initial session state
        window.api.sessionGetState().then(setSessionState).catch(console.error);
    }, []);

    // screenshot capture loop - only runs during active session
    useEffect(() => {
        if (!sessionState?.isActive) {
            if (timerRef.current) window.clearInterval(timerRef.current);
            return;
        }

        // Calculate time until first screenshot (30s into session)
        const now = Date.now();
        const elapsed = now - sessionState.startTime;
        const firstScreenshotDelay = Math.max(0, 30_000 - elapsed);

        // Schedule first screenshot
        const timeoutId = window.setTimeout(() => {
            void grab();

            // Then schedule every 30s
            timerRef.current = window.setInterval(() => {
                void grab();
            }, 30_000);
        }, firstScreenshotDelay);

        return () => {
            window.clearTimeout(timeoutId);
            if (timerRef.current) window.clearInterval(timerRef.current);
        };
    }, [sessionState?.isActive, sessionState?.startTime]);

    // handler function to open settings
    async function openSettings() {
        const res = await window.api.openScreenRecordingSettings();
        if (!res.ok) {
            console.log("failed to open settings")
        }
    }
    //  handler to relaunch
    async function relaunch() {
        await window.api.relaunchApp();
    }

    // handler to open panel for session setup
    async function openSessionPanel() {
        console.log('openSessionPanel called');
        await window.api.requestSessionSetup();
        console.log('requestSessionSetup completed');
        await window.api.showPanel();
    }

    // handler to end session
    async function handleEndSession() {
        const res = await window.api.sessionStop();
        if (res.ok) {
            console.log('Session ended');
        } else {
            console.error('Failed to end session:', res.error);
        }
    }

    // handler to quit application
    async function handleQuitApp() {
        await window.api.quitApp();
    }

    // handler to open settings panel
    async function handleOpenSettings() {
        console.log('handleOpenSettings called');
        await window.api.requestSettings();
        console.log('requestSettings completed');
        await window.api.showPanel();
    }

    // handler to open analysis panel
    async function handleOpenPanel() {
        console.log('handleOpenPanel called');
        await window.api.requestAnalysis();
        console.log('requestAnalysis completed');
        await window.api.showPanel();
    }

    // render react UI, conditionally render img if available
    return (
        <>
            <WidgetShell>
                {/* Top wedge - Session */}
                {sessionState?.isActive ? (
                    <button
                        className="wedge-button wedge-top"
                        onClick={handleEndSession}
                        title="End session"
                    >
                        <span className="wedge-label">end</span>
                    </button>
                ) : (
                    <button
                        className="wedge-button wedge-top"
                        onClick={openSessionPanel}
                        title="New session"
                    >
                        <span className="wedge-label">New Session</span>
                    </button>
                )}

                {/* Right wedge - Settings */}
                <button
                    className="wedge-button wedge-right"
                    onClick={handleOpenSettings}
                    title="Settings"
                >
                    <span className="wedge-label">Settings</span>
                </button>

                {/* Bottom wedge - Quit */}
                <button
                    className="wedge-button wedge-bottom"
                    onClick={handleQuitApp}
                    title="Quit"
                >
                    <span className="wedge-label">Quit</span>
                </button>

                {/* Left wedge - Open Panel */}
                <button
                    className="wedge-button wedge-left"
                    onClick={handleOpenPanel}
                    title="Open panel"
                >
                    <span className="wedge-label">Panel</span>
                </button>
            </WidgetShell>

            {/* permissions modal */}
            {
                showPermModal && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(0,0,0,0.45)',
                            display: 'grid',
                            placeItems: 'center',
                            zIndex: 9999
                        }}>
                        <div
                            style={{
                                width: 480,
                                background: 'white',
                                borderRadius: 12,
                                padding: 20,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                                color: 'black'
                            }}>
                            <h2 style={{ marginTop: 0 }}>Screen Recording permissions required</h2>
                            <ol style={{ lineHeight: 1.6, paddingLeft: 18 }}>
                                <li> Click <b>Open Settings</b> to jump to "Screen Recording".</li>
                                <li>Enable permissions for Attend in the list.</li>
                                <li>Click <b>I enabled it - Restart</b> to relaunch the app.</li>
                            </ol>
                            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                                <button onClick={openSettings}>Open Settings</button>
                                <button onClick={relaunch}>I enabled it - Restart</button>
                                <button onClick={() => setShowPermModal(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* display screenshot for dev/debugging */}
            {/* {img && (
        <div style={{ marginTop: 16 }}>
          <img src={img} alt="screencap" style={{ maxWidth: '100%' }} />
        </div>
      )} */}
        </>
    );
}