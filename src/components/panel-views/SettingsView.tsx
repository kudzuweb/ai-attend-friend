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
            <h2 className={'panel'} style={{ fontWeight: 600 }}>settings</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={'panel'} onClick={onClose}>close</button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: 14 }}>enable tasks</label>
                    <div
                        onClick={() => handleToggleTasks(!tasksEnabled)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: tasksEnabled ? 'flex-end' : 'flex-start',
                            width: 48,
                            height: 28,
                            background: tasksEnabled ? '#8B7355' : 'rgba(0,0,0,0.3)',
                            borderRadius: 14,
                            padding: '2px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                        }}
                    >
                        <div
                            style={{
                                width: 24,
                                height: 24,
                                background: 'white',
                                borderRadius: 12,
                                transition: 'transform 0.2s',
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}
