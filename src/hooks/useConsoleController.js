import { useCallback, useEffect, useMemo, useState } from "react";

import { useAccessNavigation } from "./useAccessNavigation";
import { useActiveRosterPolling } from "./useActiveRosterPolling";
import { useAdminZoneListActions } from "./useAdminZoneListActions";
import { useConsoleBootstrap } from "./useConsoleBootstrap";
import { useConsoleDerivedState } from "./useConsoleDerivedState";
import { useConsoleRouteProps } from "./useConsoleRouteProps";
import { useMatrixAlerts } from "./useMatrixAlerts";
import { useRecordMutationActions } from "./useRecordMutationActions";
import { useResponderSessionActions } from "./useResponderSessionActions";
import { useResponderHeartbeat } from "./useResponderHeartbeat";
import { useSelectedRecordDetail } from "./useSelectedRecordDetail";
import { useModuleCatalog } from "../modules/host/useModuleCatalog";
import {
  enabledModuleNavigation,
  installedModuleManifests,
  isModuleNavigation,
} from "../modules/moduleRegistry";

function navigationFromHash() {
  const match = window.location.hash.match(/^#\/modules\/([^/]+)\/([^/]+)$/);
  return match
    ? `module:${decodeURIComponent(match[1])}:${decodeURIComponent(match[2])}`
    : "Active Queue";
}

export function useConsoleController() {
  const [activeNav, setActiveNavState] = useState(navigationFromHash);
  const setActiveNav = useCallback((value) => {
    setActiveNavState((current) => {
      const next = typeof value === "function" ? value(current) : value;
      if (isModuleNavigation(next)) {
        const [, moduleId, viewId] = next.split(":", 3);
        window.history.replaceState(
          null,
          "",
          `#/modules/${encodeURIComponent(moduleId)}/${encodeURIComponent(viewId)}`,
        );
      } else if (window.location.hash.startsWith("#/modules/")) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      return next;
    });
  }, []);
  const [activeDetailTab, setActiveDetailTab] = useState("Overview");
  const [records, setRecords] = useState([]);
  const [responders, setResponders] = useState([]);
  const [zones, setZones] = useState([]);
  const [meResponder, setMeResponder] = useState(null);
  const [meCapabilities, setMeCapabilities] = useState({
    is_admin: false,
    can_dispatch: false,
    can_respond: false,
  });
  const [assignmentsByRecordId, setAssignmentsByRecordId] = useState({});
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [selectedAuditEvents, setSelectedAuditEvents] = useState([]);
  const [subjectId, setSubjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [responderCapacity, setResponderCapacity] = useState(null);
  const [selectedCapacityZoneId, setSelectedCapacityZoneId] = useState("");
  const [responderAddNoteOpen, setResponderAddNoteOpen] = useState(false);
  const [responderNotesHistoryOpen, setResponderNotesHistoryOpen] = useState(false);
  const [matrixStatus, setMatrixStatus] = useState(null);
  const [systemAuditEvents, setSystemAuditEvents] = useState([]);

  const moduleCatalog = useModuleCatalog(Boolean(meResponder));
  const moduleNavItems = useMemo(
    () => enabledModuleNavigation(moduleCatalog.catalog, meResponder),
    [moduleCatalog.catalog, meResponder],
  );

  useEffect(() => {
    const onHashChange = () => setActiveNavState(navigationFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const {
    allowedNavItems,
    canDispatch,
    currentResponder,
    isAdmin,
  } = useAccessNavigation({
    activeDetailTab,
    meCapabilities,
    meResponder,
    moduleNavItems,
    responders,
    setActiveDetailTab,
    setActiveNav,
    subjectId,
  });

  useActiveRosterPolling({
    activeNav,
    canDispatch,
    setResponders,
  });

  useConsoleBootstrap({
    activeNav,
    setAssignmentsByRecordId,
    setError,
    setLoading,
    setMatrixStatus,
    setMeCapabilities,
    setMeResponder,
    setRecords,
    setResponderCapacity,
    setResponders,
    setSelectedRecordId,
    setSubjectId,
    setSystemAuditEvents,
    setZones,
  });

  useSelectedRecordDetail({
    assignmentsByRecordId,
    canDispatch,
    meResponder,
    responders,
    selectedRecordId,
    setDetailLoading,
    setError,
    setSelectedAuditEvents,
    setSelectedNotes,
    subjectId,
  });

  const {
    availabilitySaving,
    handleSignOut,
    handleUpdateAvailability,
  } = useResponderSessionActions({
    meResponder,
    setError,
    setMeCapabilities,
    setMeResponder,
    setResponders,
  });

    useResponderHeartbeat({
      enabled: Boolean(meResponder?.id),
      setMeResponder,
      setResponders,
    });

  const {
    handleAssignmentCreated,
    handleAssignmentDeleted,
    handleMyAssignmentUpdate,
    handleNoteCreated,
    handleRecordCreated,
    handleRecordSelected,
    handleRecordUpdated,
    handleResponderZoneAdded,
    handleResponderZoneRemoved,
  } = useRecordMutationActions({
    canDispatch,
    records,
    setActiveDetailTab,
    setActiveNav,
    setAssignmentsByRecordId,
    setError,
    setRecords,
    setResponders,
    setSelectedAuditEvents,
    setSelectedNotes,
    setSelectedRecordId,
  });

  const {
    currentResponderAssignment,
    currentResponderRows,
    effectiveCapacityZoneId,
    isActiveQueueRecord,
    isArchivedQueueRecord,
    isClosedQueueRecord,
    isDispatchQueueRecord,
    responderConsoleRecords,
    responderMap,
    responderSelectedAssignments,
    responderSelectedRecord,
    selectedAssignments,
    selectedRecord,
    visibleDetailTabs,
  } = useConsoleDerivedState({
    activeNav,
    assignmentsByRecordId,
    canDispatch,
    meResponder,
    records,
    responderCapacity,
    responders,
    selectedCapacityZoneId,
    selectedRecordId,
    subjectId,
  });

  const {
    handleResponderDeleted,
    handleResponderSaved,
    handleZoneCreated,
    handleZoneDeleted,
    handleZoneUpdated,
  } = useAdminZoneListActions({
    setResponders,
    setZones,
  });

  const {
    alertDestination,
    setAlertDestination,
    alertResponderId,
    setAlertResponderId,
    alertZoneId,
    setAlertZoneId,
    alertNote,
    setAlertNote,
    alertSending,
    alertResult,
    canRetryAlert,
    handleSendAlert,
    handleRetryLastAlert,
  } = useMatrixAlerts({
    selectedRecord,
    setError,
    setSelectedAuditEvents,
  });

  const consoleRouteProps = useConsoleRouteProps({
    activeDetailTab,
    activeNav,
    alertDestination,
    alertNote,
    alertResponderId,
    alertResult,
    alertSending,
    alertZoneId,
    allowedNavItems,
    assignmentsByRecordId,
    availabilitySaving,
    canDispatch,
    canRetryAlert,
    currentResponderAssignment,
    currentResponderRows,
    detailLoading,
    effectiveCapacityZoneId,
    error,
    handleAssignmentCreated,
    handleAssignmentDeleted,
    handleMyAssignmentUpdate,
    handleNoteCreated,
    handleRecordCreated,
    handleRecordSelected,
    handleRecordUpdated,
    handleResponderDeleted,
    handleResponderSaved,
    handleResponderZoneAdded,
    handleResponderZoneRemoved,
    handleRetryLastAlert,
    handleSendAlert,
    handleUpdateAvailability,
    handleZoneCreated,
    handleZoneDeleted,
    handleZoneUpdated,
    isActiveQueueRecord,
    isAdmin,
    isArchivedQueueRecord,
    isClosedQueueRecord,
    isDispatchQueueRecord,
    loading,
    matrixStatus,
    records,
    responderAddNoteOpen,
    responderCapacity,
    responderConsoleRecords,
    responderMap,
    responderNotesHistoryOpen,
    responderSelectedAssignments,
    responderSelectedRecord,
    responders,
    selectedAssignments,
    selectedAuditEvents,
    selectedNotes,
    selectedRecord,
    setActiveDetailTab,
    setAlertDestination,
    setAlertNote,
    setAlertResponderId,
    setAlertZoneId,
    setResponderAddNoteOpen,
    setResponderNotesHistoryOpen,
    setSelectedCapacityZoneId,
    subjectId,
    systemAuditEvents,
    visibleDetailTabs,
    zones,
  });

  return {
    activeNav,
    allowedNavItems,
    consoleRouteProps,
    currentResponder,
    handleSignOut,
    meResponder,
    moduleRuntime: {
      catalog: moduleCatalog.catalog,
      installedManifests: installedModuleManifests,
      loading: moduleCatalog.loading,
      refresh: moduleCatalog.refresh,
    },
    setActiveNav,
    subjectId,
  };
}
