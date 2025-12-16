import MainApp from "./components/MainApp"
import SessionWidgetApp from "./components/SessionWidgetApp"
import LoadingScreen from "./components/LoadingScreen"
import { ThemeProvider } from "./contexts/ThemeContext"
import { SettingsProvider, useSettings } from "./contexts/SettingsContext"
import { SessionProvider, useSession } from "./contexts/SessionContext"

function AppContent() {
  const route = window.location.hash;
  const { isLoading: settingsLoading } = useSettings();
  const { isLoading: sessionLoading } = useSession();

  const isLoading = settingsLoading || sessionLoading;

  if (route === '#/session-widget') {
    return <SessionWidgetApp />;
  }

  if (isLoading) {
    return <LoadingScreen />;
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
