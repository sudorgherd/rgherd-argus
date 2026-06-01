import ConsoleShell from "./shell/ConsoleShell";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import { useConsoleController } from "./hooks/useConsoleController";

function App() {
  const pathname = window.location.pathname;

  if (pathname === "/access-denied") {
    return <AccessDeniedPage />;
  }

  const consoleShellProps = useConsoleController();

  return <ConsoleShell {...consoleShellProps} />;
}

export default App;
