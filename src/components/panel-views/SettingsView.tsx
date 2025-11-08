import { useState, useEffect } from "react";
import { useTheme, type Theme } from "../../contexts/ThemeContext";

interface SettingsViewProps {
    onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
    const [tasksEnabled, setTasksEnabled] = useState<boolean>(true);
    const [demoMode, setDemoMode] = useState<boolean>(true);
    const { theme, setTheme } = useTheme();

    // Load settings from localStorage
    useEffect(() => {
        const savedTasks = localStorage.getItem('tasksEnabled');
        if (savedTasks !== null) {
            setTasksEnabled(JSON.parse(savedTasks));
        }

        const savedDemo = localStorage.getItem('demoMode');
        if (savedDemo !== null) {
            setDemoMode(JSON.parse(savedDemo));
        }
    }, []);

    // Save to localStorage when toggled
    const handleToggleTasks = (enabled: boolean) => {
        setTasksEnabled(enabled);
        localStorage.setItem('tasksEnabled', JSON.stringify(enabled));
    };

    const handleToggleDemoMode = (enabled: boolean) => {
        setDemoMode(enabled);
        localStorage.setItem('demoMode', JSON.stringify(enabled));
        // Dispatch storage event so other components can react
        window.dispatchEvent(new Event('storage'));
    };

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
    };

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
