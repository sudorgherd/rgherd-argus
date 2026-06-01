import { useEffect, useMemo, useRef } from "react";

import { getRecordAudit } from "../modules/audit/auditApi";
import { listRecordNotesWithStatus } from "../modules/notes/notesApi";
import { safeArray } from "../utils/display";

const SELECTED_DETAIL_REFRESH_MS = 30000;

function buildAssignmentSignature(assignments) {
  return safeArray(assignments)
    .map((assignment) =>
      [
        assignment.id ?? "",
        assignment.responder_id ?? "",
        assignment.assignment_state ?? "",
        assignment.cleared_at ?? "",
      ].join(":")
    )
    .sort()
    .join("|");
}

export function useSelectedRecordDetail({
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
}) {
  const lastDetailRecordIdRef = useRef(null);

  const selectedRecordAssignments = safeArray(assignmentsByRecordId[selectedRecordId]);

  const selectedRecordAssignmentSignature = useMemo(
    () => buildAssignmentSignature(selectedRecordAssignments),
    [selectedRecordAssignments]
  );

  const currentResponderId = useMemo(() => {
    if (meResponder?.subject_id === subjectId) {
      return meResponder.id ?? null;
    }

    return (
      safeArray(responders).find((responder) => responder.subject_id === subjectId)?.id ?? null
    );
  }, [meResponder?.id, meResponder?.subject_id, responders, subjectId]);

  const canViewSelectedNotes = useMemo(() => {
    if (canDispatch) return true;
    if (!currentResponderId) return false;

    return selectedRecordAssignments.some(
      (assignment) => assignment.responder_id === currentResponderId
    );
  }, [canDispatch, currentResponderId, selectedRecordAssignmentSignature]);

  const canViewSelectedAudit = Boolean(canDispatch);

  useEffect(() => {
    if (!selectedRecordId) {
      lastDetailRecordIdRef.current = null;
      setSelectedNotes([]);
      setSelectedAuditEvents([]);
      setDetailLoading(false);
      return;
    }

    let ignore = false;
    const showInitialDetailLoading = lastDetailRecordIdRef.current !== selectedRecordId;
    lastDetailRecordIdRef.current = selectedRecordId;

    async function loadSelectedDetail(showLoading = false) {
      if (showLoading) {
        setDetailLoading(true);
      }

      try {
        if (canViewSelectedNotes) {
          try {
            const notesData = await listRecordNotesWithStatus(selectedRecordId);

            if (ignore) return;
            setSelectedNotes(safeArray(notesData.notes));
          } catch (err) {
            if (!canDispatch && err?.status === 403) {
              if (!ignore) {
                setSelectedNotes([]);
                setSelectedAuditEvents([]);
                setError("");
              }
              return;
            }

            throw err;
          }
        } else {
          setSelectedNotes([]);
        }

        if (canViewSelectedAudit) {
          const auditData = await getRecordAudit(selectedRecordId);

          if (ignore) return;
          setSelectedAuditEvents(safeArray(auditData.audit_events));
        } else {
          setSelectedAuditEvents([]);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load selected record detail");
        }
      } finally {
        if (!ignore) {
          setDetailLoading(false);
        }
      }
    }

    loadSelectedDetail(showInitialDetailLoading);

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        loadSelectedDetail(false);
      }
    }, SELECTED_DETAIL_REFRESH_MS);

    return () => {
      ignore = true;
      window.clearInterval(intervalId);
    };
  }, [
    canDispatch,
    canViewSelectedAudit,
    canViewSelectedNotes,
    selectedRecordAssignmentSignature,
    selectedRecordId,
    setDetailLoading,
    setError,
    setSelectedAuditEvents,
    setSelectedNotes,
  ]);
}
