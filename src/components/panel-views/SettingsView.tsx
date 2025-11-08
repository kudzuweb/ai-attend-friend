import { useState, useEffect } from "react";

interface SettingsViewProps {
    onClose: () => void;
}

export default function SettingsView({ onClose }: SettingsViewProps) {
    const [tasksEnabled, setTasksEnabled] = useState<boolean>(true);

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

    return (
        <>
            <h2 className="panel-title">Settings</h2>
            <div className="flex-row-end mb-16">
                <button className="button-secondary" onClick={onClose}>Close</button>
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
            </div>
        </>
    );
}
