import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type AppSettings = {
    windowPosition: 'top-left' | 'top-center' | 'top-right';
    tasksEnabled: boolean;
    demoMode: boolean;
};

type SettingsContextValue = {
    settings: AppSettings | null;
    isLoading: boolean;
    refreshSettings: () => Promise<void>;
    updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings | null>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Version counter to handle out-of-order API responses
    const updateVersionRef = useRef(0);

    const refreshSettings = useCallback(async () => {
        // Increment version to invalidate any in-flight updates
        updateVersionRef.current++;
        try {
            console.log('[SettingsContext] Loading settings from backend...');
            const data = await window.api.getSettings();
            console.log('[SettingsContext] Settings loaded:', data);
            setSettings(data);
        } catch (error) {
            console.error('[SettingsContext] Failed to load settings', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
        // Capture version for this request
        const thisVersion = ++updateVersionRef.current;

        // Optimistic update - immediately apply the partial
        setSettings(prev => prev ? { ...prev, ...partial } : null);

        try {
            console.log('[SettingsContext] Updating settings:', partial);
            const updated = await window.api.updateSettings(partial);
            console.log('[SettingsContext] Settings updated:', updated);

            // Only apply API response if this is still the latest request
            if (thisVersion === updateVersionRef.current) {
                setSettings(updated);
            }
            return updated;
        } catch (error) {
            console.error('[SettingsContext] Failed to update settings', error);
            // Rollback on error by refreshing from backend
            if (thisVersion === updateVersionRef.current) {
                await refreshSettings();
            }
            return null;
        }
    }, [refreshSettings]);

    useEffect(() => {
        void refreshSettings();
    }, [refreshSettings]);

    const value = useMemo<SettingsContextValue>(() => ({
        settings,
        isLoading,
        refreshSettings,
        updateSettings,
    }), [settings, isLoading, refreshSettings, updateSettings]);

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
