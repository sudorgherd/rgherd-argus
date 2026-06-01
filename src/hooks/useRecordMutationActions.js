import { deleteAssignment, updateAssignment } from "../modules/assignments/assignmentsApi";
import { getRecordAudit } from "../modules/audit/auditApi";
import { addResponderZone, removeResponderZone } from "../modules/responders/respondersApi";
import { safeArray } from "../utils/display";

export function useRecordMutationActions({
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
}) {
  function handleRecordCreated(createdRecord) {
    setRecords((current) => [createdRecord, ...current]);
    setSelectedRecordId(createdRecord.id);
    setActiveDetailTab("Overview");
    setActiveNav(createdRecord.active_response ? "Active Queue" : "Dispatch Queue");
    setAssignmentsByRecordId((current) => ({
      ...current,
      [createdRecord.id]: [],
    }));
    setSelectedNotes([]);
    setSelectedAuditEvents([]);
    setError("");
  }

  function handleRecordUpdated(updatedRecord) {
    if (updatedRecord?.purged) {
      setRecords((current) => current.filter((record) => record.id !== updatedRecord.id));
      setAssignmentsByRecordId((current) => {
        const next = { ...current };
        delete next[updatedRecord.id];
        return next;
      });
      setSelectedNotes([]);
      setSelectedAuditEvents([]);
      setSelectedRecordId((currentSelectedId) => {
        if (currentSelectedId !== updatedRecord.id) return currentSelectedId;
        const remaining = records.filter((record) => record.id !== updatedRecord.id);
        return remaining[0]?.id ?? null;
      });
      setError("");
      return;
    }

    setRecords((current) =>
      current.map((record) =>
        record.id === updatedRecord.id ? { ...record, ...updatedRecord } : record
      )
    );
    setError("");
  }

  async function handleNoteCreated(createdNote) {
    setSelectedNotes((current) => [createdNote, ...current]);
    setError("");

    if (!canDispatch) {
      return;
    }

    try {
      const auditData = await getRecordAudit(createdNote.record_id);
      setSelectedAuditEvents(safeArray(auditData.audit_events));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh audit trail");
    }
  }

  function handleAssignmentCreated(createdAssignment) {
    setAssignmentsByRecordId((current) => {
      const recordId = createdAssignment.record_id;
      const existing = current[recordId] || [];
      return {
        ...current,
        [recordId]: [createdAssignment, ...existing],
      };
    });
    setError("");
  }

  async function handleAssignmentDeleted(assignment) {
    try {
      await deleteAssignment(assignment.record_id, assignment.id);

      setAssignmentsByRecordId((current) => {
        const existing = current[assignment.record_id] || [];
        return {
          ...current,
          [assignment.record_id]: existing.filter((item) => item.id !== assignment.id),
        };
      });

      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unassign responder");
      throw err;
    }
  }

  async function handleMyAssignmentUpdate(recordId, assignmentId, payload) {
    try {
      const updatedAssignment = await updateAssignment(recordId, assignmentId, payload);

      setAssignmentsByRecordId((current) => {
        const existing = current[recordId] || [];
        return {
          ...current,
          [recordId]: existing.map((item) =>
            item.id === updatedAssignment.id ? updatedAssignment : item
          ),
        };
      });

      setError("");
      return updatedAssignment;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update responder assignment");
      throw err;
    }
  }

  async function handleResponderZoneAdded(responderId, zoneId) {
    try {
      const data = await addResponderZone(responderId, zoneId);

      setResponders((current) =>
        current.map((responder) => (responder.id === data.id ? data : responder))
      );
      setError("");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add responder zone");
      throw err;
    }
  }

  async function handleResponderZoneRemoved(responderId, zoneId) {
    try {
      const data = await removeResponderZone(responderId, zoneId);

      setResponders((current) =>
        current.map((responder) => (responder.id === data.id ? data : responder))
      );
      setError("");
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove responder zone");
      throw err;
    }
  }

  return {
    handleAssignmentCreated,
    handleAssignmentDeleted,
    handleMyAssignmentUpdate,
    handleNoteCreated,
    handleRecordCreated,
    handleRecordUpdated,
    handleResponderZoneAdded,
    handleResponderZoneRemoved,
  };
}
