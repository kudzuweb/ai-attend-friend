import { useState, useEffect } from "react";
import { useTheme, type Theme } from "../../contexts/ThemeContext";

interface SettingsViewProps {
    onClose: () => void;
}

type WindowPosition = 'top-left' | 'top-center' | 'top-right';

export default function SettingsView({ onClose }: SettingsViewProps) {
    const [tasksEnabled, setTasksEnabled] = useState<boolean>(true);
    const [demoMode, setDemoMode] = useState<boolean>(true);
    const [windowPosition, setWindowPosition] = useState<WindowPosition>('top-right');
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

        const savedPosition = localStorage.getItem('windowPosition') as WindowPosition;
        if (savedPosition && ['top-left', 'top-center', 'top-right'].includes(savedPosition)) {
            setWindowPosition(savedPosition);
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

    const handlePositionChange = async (newPosition: WindowPosition) => {
        setWindowPosition(newPosition);
        localStorage.setItem('windowPosition', newPosition);
        // Call IPC to reposition window
        if (window.api?.setWindowPosition) {
            await window.api.setWindowPosition(newPosition);
        }
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
