import { useTheme, type Theme } from "../../contexts/ThemeContext";
import { useSettings } from "../../contexts/SettingsContext";

interface SettingsViewProps {
    onClose: () => void;
}

type WindowPosition = 'top-left' | 'top-center' | 'top-right';

export default function SettingsView({ onClose }: SettingsViewProps) {
    const { settings, isLoading, updateSettings } = useSettings();
    const { theme, setTheme } = useTheme();

    const tasksEnabled = settings?.tasksEnabled ?? true;
    const demoMode = settings?.demoMode ?? true;
    const windowPosition = settings?.windowPosition ?? 'top-right';

    const handleToggleTasks = (enabled: boolean) => {
        void updateSettings({ tasksEnabled: enabled });
    };

    const handleToggleDemoMode = (enabled: boolean) => {
        void updateSettings({ demoMode: enabled });
    };

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
    };

    const handlePositionChange = async (newPosition: WindowPosition) => {
        // Call IPC to reposition window - this will also update ConfigService
        await window.api.setWindowPosition(newPosition);
    };

    if (isLoading) {
        return (
            <>
                <div className="flex-row-end mb-16">
                    <button className="button-secondary" onClick={onClose}>Close</button>
                </div>
                <p>Loading settings...</p>
            </>
        );
    }

    return (
        <>
            <div className="flex-row-end mb-16">
                <button className="button-secondary" onClick={onClose}>Close</button>
            </div>
            <h2 className="panel-title">Settings</h2>

            <div className="form-section mb-16">
                <label>Theme</label>
                <div className="button-row-equal">
                    <button
                        className={theme === 'light' ? 'button-primary' : 'button-secondary'}
                        onClick={() => handleThemeChange('light')}
                    >
                        Light
                    </button>
                    <button
                        className={theme === 'dark' ? 'button-primary' : 'button-secondary'}
                        onClick={() => handleThemeChange('dark')}
                    >
                        Dark
                    </button>
                    <button
                        className={theme === 'system' ? 'button-primary' : 'button-secondary'}
                        onClick={() => handleThemeChange('system')}
                    >
                        System
                    </button>
                </div>
            </div>

            <div className="form-section mb-16">
                <label>Window Position</label>
                <div className="button-row-equal">
                    <button
                        className={windowPosition === 'top-left' ? 'button-primary' : 'button-secondary'}
                        onClick={() => handlePositionChange('top-left')}
                    >
                        Top Left
                    </button>
                    <button
                        className={windowPosition === 'top-center' ? 'button-primary' : 'button-secondary'}
                        onClick={() => handlePositionChange('top-center')}
                    >
                        Top Center
                    </button>
                    <button
                        className={windowPosition === 'top-right' ? 'button-primary' : 'button-secondary'}
                        onClick={() => handlePositionChange('top-right')}
                    >
                        Top Right
                    </button>
                </div>
            </div>


            <div className="panel-content">
                <div className="toggle-switch">
                    <label>Enable priority task view</label>
                    <div
                        className={`toggle-track ${tasksEnabled ? 'active' : ''}`}
                        onClick={() => handleToggleTasks(!tasksEnabled)}
                    >
                        <div className="toggle-thumb" />
                    </div>
                </div>

                <div className="toggle-switch">
                    <label>Demo mode</label>
                    <div
                        className={`toggle-track ${demoMode ? 'active' : ''}`}
                        onClick={() => handleToggleDemoMode(!demoMode)}
                    >
                        <div className="toggle-thumb" />
                    </div>
                </div>
            </div>
        </>
    );
}
