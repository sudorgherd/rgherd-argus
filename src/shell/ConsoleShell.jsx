import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import ModuleOutlet from "./ModuleOutlet";
import ConsoleRoutes from "./ConsoleRoutes";
import ModuleView from "../modules/host/ModuleView";
import { isModuleNavigation } from "../modules/moduleRegistry";

function profileLabelFor(responder) {
  if (!responder) return "No operational profile";

  if (responder.is_admin) return "Admin / Dispatch / Respond";

  const capabilities = [];
  if (responder.can_dispatch) capabilities.push("Dispatch");
  if (responder.can_respond) capabilities.push("Respond");

  return capabilities.length ? capabilities.join(" / ") : "No operational access";
}

function usernameFor(responder, subjectId) {
  return responder?.matrix_user_id || responder?.subject_id || subjectId || "";
}

export default function ConsoleShell({
  activeNav,
  allowedNavItems,
  consoleRouteProps,
  currentResponder,
  handleSignOut,
  meResponder,
  moduleRuntime,
  setActiveNav,
  subjectId,
}) {
  const operator = currentResponder || meResponder || null;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="grid min-h-screen grid-cols-[250px_1fr]">
        <Sidebar activeNav={activeNav} onSelect={setActiveNav} navItems={allowedNavItems} />

        <div className="flex flex-col">
          <TopBar
            appVersion="v1.2.0"
            operatorLabel={operator?.display_name || subjectId || "—"}
            operatorProfileLabel={profileLabelFor(operator)}
            operatorUsername={usernameFor(operator, subjectId)}
            onSignOut={handleSignOut}
          />

          <ModuleOutlet>
            {isModuleNavigation(activeNav) ? (
              <ModuleView
                activeNav={activeNav}
                runtime={moduleRuntime}
                host={{
                  currentResponder: operator,
                  responders: consoleRouteProps.data.responders,
                  zones: consoleRouteProps.data.zones,
                  navigate: setActiveNav,
                  refreshModules: moduleRuntime.refresh,
                }}
              />
            ) : (
              <ConsoleRoutes {...consoleRouteProps} />
            )}
          </ModuleOutlet>
        </div>
      </div>
    </div>
  );
}
