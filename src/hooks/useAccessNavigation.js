import { useEffect, useMemo } from "react";

export function useAccessNavigation({
  activeDetailTab,
  meCapabilities,
  meResponder,
  responders,
  setActiveDetailTab,
  setActiveNav,
  subjectId,
}) {
  const currentResponder = useMemo(
    () =>
      meResponder && meResponder.subject_id === subjectId
        ? meResponder
        : responders.find((responder) => responder.subject_id === subjectId) || null,
    [meResponder, responders, subjectId]
  );

  const isAdmin = Boolean(meCapabilities.is_admin);
  const canDispatch = Boolean(meCapabilities.can_dispatch || isAdmin);
  const canRespond = Boolean(meCapabilities.can_respond || isAdmin);

  const allowedNavItems = useMemo(() => {
    if (isAdmin) {
      return [
        "Active Queue",
        "Dispatch Queue",
        "Report Intake",
        "Active Roster",
        "Responder Interface",
        "System Audit",
        "Closed Records",
        "Archived Records",
        "Admin",
      ];
    }

    if (canDispatch && canRespond) {
      return [
        "Active Queue",
        "Dispatch Queue",
        "Report Intake",
        "Active Roster",
        "Responder Interface",
        "System Audit",
        "Closed Records",
        "Archived Records",
      ];
    }

    if (canDispatch) {
      return [
        "Active Queue",
        "Dispatch Queue",
        "Report Intake",
        "Active Roster",
        "System Audit",
        "Closed Records",
        "Archived Records",
      ];
    }

    if (canRespond) {
      return ["Responder Interface"];
    }

    return [];
  }, [canDispatch, canRespond, isAdmin]);

  useEffect(() => {
    if (allowedNavItems.length === 0) {
      setActiveNav("");
      return;
    }

    setActiveNav((current) => {
      if (allowedNavItems.includes(current)) return current;
      if (canDispatch) return "Active Queue";
      if (canRespond) return "Responder Interface";
      return allowedNavItems[0];
    });
  }, [allowedNavItems, canDispatch, canRespond, setActiveNav]);

  useEffect(() => {
    if (!canDispatch && activeDetailTab === "Audit") {
      setActiveDetailTab("Overview");
    }
  }, [activeDetailTab, canDispatch, setActiveDetailTab]);

  return {
    allowedNavItems,
    canDispatch,
    canRespond,
    currentResponder,
    isAdmin,
  };
}
