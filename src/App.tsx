import WidgetApp from "./components/WidgetApp"
import PanelApp from "./components/PanelApp"
import { ThemeProvider } from "./contexts/ThemeContext"

function App() {
  const isPanel = window.location.hash === '#/panel';
  return (
    <ThemeProvider>
      {isPanel ? <PanelApp /> : <WidgetApp />}
    </ThemeProvider>
  );
}

export default App
