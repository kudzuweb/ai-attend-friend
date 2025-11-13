import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type SessionContextValue = {
    sessionState: SessionState | null;
    isLoading: boolean;
    refreshSessionState: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [sessionState, setSessionState] = useState<SessionState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshSessionState = useCallback(async () => {
        try {
            const state = await window.api.sessionGetState();
            setSessionState(state);
        } catch (error) {
            console.error('[SessionContext] Failed to fetch session state', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void refreshSessionState();
        const unsubscribe = window.api.onSessionUpdated((state) => {
            setSessionState(state);
            setIsLoading(false);
        });
        return () => {
            unsubscribe?.();
        };
    }, [refreshSessionState]);

    const value = useMemo<SessionContextValue>(() => ({
        sessionState,
        isLoading,
        refreshSessionState,
    }), [sessionState, isLoading, refreshSessionState]);

    return (
        <SessionContext.Provider value={value}>
            {children}
        </SessionContext.Provider>
    );
}

export function useSession() {
    const context = useContext(SessionContext);
    if (!context) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
}
