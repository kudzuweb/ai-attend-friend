import { useState, useEffect } from "react";
import { useTheme, type Theme } from "../../contexts/ThemeContext";

interface SettingsViewProps {
    onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
    const [tasksEnabled, setTasksEnabled] = useState<boolean>(true);
    const { theme, setTheme } = useTheme();

    // Load settings from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('tasksEnabled');
        if (saved !== null) {
            setTasksEnabled(JSON.parse(saved));
        }
    }, []);

    // Save to localStorage when toggled
    const handleToggleTasks = (enabled: boolean) => {
        setTasksEnabled(enabled);
        localStorage.setItem('tasksEnabled', JSON.stringify(enabled));
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

                <div className="form-section">
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
            </div>
        </>
    );
}
