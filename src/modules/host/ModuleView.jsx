import { Boxes, LockKeyhole } from "lucide-react";

import { apiRequest } from "../../api/request";
import { Panel } from "../../components/ui";
import { formatDateTime, responderLabel, safeArray } from "../../utils/display";
import {
  capabilityAllows,
  findInstalledModuleRoute,
} from "../moduleRegistry";

export default function ModuleView({ activeNav, host, runtime }) {
  const route = findInstalledModuleRoute(activeNav);
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
  );
}
