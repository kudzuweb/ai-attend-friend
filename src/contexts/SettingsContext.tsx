import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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

    const refreshSettings = useCallback(async () => {
        try {
            const data = await window.api.getSettings();
            setSettings(data);
        } catch (error) {
            console.error('[SettingsContext] Failed to load settings', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
        try {
            const updated = await window.api.updateSettings(partial);
            setSettings(updated);
            return updated;
        } catch (error) {
            console.error('[SettingsContext] Failed to update settings', error);
            return null;
        }
    }, []);

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
