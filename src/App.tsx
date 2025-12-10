import MainApp from "./components/MainApp"
import SessionWidgetApp from "./components/SessionWidgetApp"
import { ThemeProvider } from "./contexts/ThemeContext"
import { SettingsProvider } from "./contexts/SettingsContext"
import { SessionProvider } from "./contexts/SessionContext"

function App() {
  const route = window.location.hash;

  if (route === '#/session-widget') {
    return (
      <ThemeProvider>
        <SettingsProvider>
          <SessionProvider>
            <SessionWidgetApp />
          </SessionProvider>
        </SettingsProvider>
      </ThemeProvider>
    );
  }

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

export default App
