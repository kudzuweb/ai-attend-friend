interface Props {
    onOpenSettings: () => void;
    onRelaunch: () => void;
}

export default function ScreenPermissionCheck({ onOpenSettings, onRelaunch }: Props) {
    return (
        <div className="permission-check">
            <div className="permission-content">
                <h1>Screen Recording Permission Required</h1>
                <p className="permission-description">
                    This app needs screen recording access to help you stay focused by analyzing your screen activity.
                </p>
                <ol className="permission-steps">
                    <li>Click <strong>Open Settings</strong> to open System Settings</li>
                    <li>Find "Attend" (or "Electron") in the list</li>
                    <li>Toggle it on to grant access</li>
                    <li>Click <strong>Restart App</strong> to apply the changes</li>
                </ol>
                <div className="permission-actions">
                    <button className="btn-primary" onClick={onOpenSettings}>
                        Open Settings
                    </button>
                    <button className="btn-secondary" onClick={onRelaunch}>
                        Restart App
                    </button>
                </div>
            </div>
        </div>
    );
}
