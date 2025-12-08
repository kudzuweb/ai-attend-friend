import { useEffect, useState } from 'react';
import WidgetApp from "./components/WidgetApp"
import PanelApp from "./components/PanelApp"
import MainApp from "./components/MainApp"
import { ThemeProvider } from "./contexts/ThemeContext"
import { SettingsProvider } from "./contexts/SettingsContext"
import { SessionProvider } from "./contexts/SessionContext"

function App() {
  const [useNewArchitecture, setUseNewArchitecture] = useState(false);
  const route = window.location.hash;

  useEffect(() => {
    async function checkArchitecture() {
      const enabled = await window.api.getUseNewArchitecture();
      setUseNewArchitecture(enabled);
    }
    checkArchitecture();
  }, []);

  // NEW ARCHITECTURE ROUTING
  if (useNewArchitecture) {
    if (route === '#/session-widget') {
      // Will implement in PR-6
      return <div>Session Widget (Coming Soon)</div>;
    }

    // Default: main app
    return (
      <ThemeProvider>
        <SettingsProvider>
          <SessionProvider>
            <MainApp />
          </SessionProvider>
        </SettingsProvider>
      </ThemeProvider>
    );
  }

  // OLD ARCHITECTURE ROUTING (unchanged)
  const isPanel = route === '#/panel';
  return (
    <ThemeProvider>
      <SettingsProvider>
        <SessionProvider>
          {isPanel ? <PanelApp /> : <WidgetApp />}
        </SessionProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}

export default App
