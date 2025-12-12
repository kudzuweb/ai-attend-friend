import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AppSettings = {
    windowPosition: 'top-left' | 'top-center' | 'top-right';
    tasksEnabled: boolean;
    demoMode: boolean;
};

type SettingsContextValue = {
    settings: AppSettings | null;
    isLoading: boolean;
    isUpdating: boolean;
    refreshSettings: () => Promise<void>;
    updateSettings: (partial: Partial<AppSettings>) => Promise<AppSettings | null>;
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    const refreshSettings = useCallback(async () => {
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
        if (isUpdating) return null;
        setIsUpdating(true);
        try {
            console.log('[SettingsContext] Updating settings:', partial);
            const updated = await window.api.updateSettings(partial);
            console.log('[SettingsContext] Settings updated:', updated);
            setSettings(updated);
            return updated;
        } catch (error) {
            console.error('[SettingsContext] Failed to update settings', error);
            return null;
        } finally {
            setIsUpdating(false);
        }
    }, [isUpdating]);

    useEffect(() => {
        void refreshSettings();
    }, [refreshSettings]);

    const value = useMemo<SettingsContextValue>(() => ({
        settings,
        isLoading,
        isUpdating,
        refreshSettings,
        updateSettings,
    }), [settings, isLoading, isUpdating, refreshSettings, updateSettings]);

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
