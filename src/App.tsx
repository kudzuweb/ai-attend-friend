import WidgetApp from "./components/WidgetApp"
import PanelApp from "./components/PanelApp"
import { ThemeProvider } from "./contexts/ThemeContext"
import { SettingsProvider } from "./contexts/SettingsContext"
import { SessionProvider } from "./contexts/SessionContext"

function App() {
  const isPanel = window.location.hash === '#/panel';
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
