import { Component } from "react";
import { Boxes, LockKeyhole } from "lucide-react";

import { apiRequest } from "../../api/request";
import { Panel } from "../../components/ui";
import { formatDateTime, responderLabel, safeArray } from "../../utils/display";
import {
  capabilityAllows,
  findInstalledModuleRoute,
} from "../moduleRegistry";

export default function ModuleView({ activeNav, host, runtime }) {
  const route = findInstalledModuleRoute(activeNav, runtime.installedManifests);
  if (!route) {
    return (
      <Panel title="Module not available" icon={Boxes}>
        <p className="text-sm text-slate-400">
          This installed module view is not present in the current console build.
        </p>
      </Panel>
    );
  }

  const backendState = runtime.catalog.find(
    (candidate) => candidate.module_id === route.manifest.moduleId,
  );
  if (!backendState?.enabled) {
    return (
      <Panel title="Module disabled" icon={Boxes}>
        <p className="text-sm text-slate-400">
          An ARGUS administrator must enable this installed module before it can be used.
        </p>
      </Panel>
    );
  }

  if (!capabilityAllows(route.entry.capability, host.currentResponder)) {
    return (
      <Panel title="Module access denied" icon={LockKeyhole}>
        <p className="text-sm text-slate-400">
          Your ARGUS responder capabilities do not allow this module view.
        </p>
      </Panel>
    );
  }

  const Component = route.entry.component;
  return (
    <ModuleErrorBoundary
      key={`${route.manifest.moduleId}:${route.entry.id}`}
      onFailure={(error) => runtime.isolateModule(route.manifest.moduleId, error)}
    >
      <Component
        host={{
          ...host,
          apiRequest,
          formatDateTime,
          responderLabel,
          safeArray,
        }}
        module={backendState}
        routeId={route.entry.id}
      />
    </ModuleErrorBoundary>
  );
}

class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("Installed ARGUS module view failed", error);
    this.props.onFailure(error);
  }

  render() {
    if (this.state.failed) {
      return (
        <Panel title="Module failed" icon={Boxes}>
          <p role="alert" className="text-sm text-rose-200">
            This optional module could not render. ARGUS core remains available;
            an administrator can disable the module from Admin → Modules.
          </p>
        </Panel>
      );
    }
    return this.props.children;
  }
}
