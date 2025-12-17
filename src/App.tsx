import { useState, useEffect } from "react"
import MainApp from "./components/MainApp"
import SessionWidgetApp from "./components/SessionWidgetApp"
import LoadingScreen from "./components/LoadingScreen"
import ScreenPermissionCheck from "./components/ScreenPermissionCheck"
import { ThemeProvider } from "./contexts/ThemeContext"
import { SettingsProvider, useSettings } from "./contexts/SettingsContext"
import { SessionProvider, useSession } from "./contexts/SessionContext"

type PermissionStatus = 'checking' | 'granted' | 'denied';

function AppContent() {
  const route = window.location.hash;
  const { isLoading: settingsLoading } = useSettings();
  const { isLoading: sessionLoading } = useSession();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('checking');

  const isLoading = settingsLoading || sessionLoading;

  // Check screen recording permission on mount
  useEffect(() => {
    async function checkPermission() {
      try {
        const status = await window.api.getScreenPermissionStatus();
        setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
      } catch (e) {
        console.error('Failed to check permission status:', e);
        setPermissionStatus('denied');
      }
    }
    checkPermission();
  }, []);

  // Session widget doesn't need permission check (main window handles it)
  if (route === '#/session-widget') {
    return <SessionWidgetApp />;
  }

  // Show loading screen while contexts load or permission check is in progress
  if (isLoading || permissionStatus === 'checking') {
    return <LoadingScreen />;
  }

  // Show permission check screen if not granted
  if (permissionStatus !== 'granted') {
    return (
      <ScreenPermissionCheck
        onOpenSettings={async () => {
          await window.api.openScreenRecordingSettings();
        }}
        onRelaunch={async () => {
          await window.api.relaunchApp();
        }}
      />
    );
  }

  return <MainApp />;
}

function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <SessionProvider>
          <AppContent />
        </SessionProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App
