import { useMemo } from "react";

import { detailTabs } from "../constants/ui";
import { safeArray } from "../utils/display";

export function useConsoleDerivedState({
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
}) {
  const responderMap = useMemo(
    () => new Map(responders.map((responder) => [responder.id, responder])),
    [responders]
  );

  const currentResponderRows = useMemo(
    () => {
      if (meResponder && meResponder.subject_id === subjectId) return [meResponder];
      return responders.filter((responder) => responder.subject_id === subjectId);
    },
    [meResponder, responders, subjectId]
  );

  const selectedRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records.find((record) => record.id === selectedRecordId) || records[0];
  }, [records, selectedRecordId]);

  const selectedAssignments = useMemo(() => {
    if (!selectedRecord) return [];
    return safeArray(assignmentsByRecordId[selectedRecord.id]);
  }, [assignmentsByRecordId, selectedRecord]);

  const isArchivedRecord = (record) => Boolean(record?.archived_at);
  const isClosedRecord = (record) => record?.status === "closed";
  const isWorkingRecord = (record) => !isArchivedRecord(record) && !isClosedRecord(record);
  const hasActiveAssignment = (record) =>
    safeArray(assignmentsByRecordId[record.id]).some(
      (assignment) => assignment.assignment_state === "active"
    );
  const isActiveQueueRecord = (record) =>
    isWorkingRecord(record) && (record.active_response || hasActiveAssignment(record));
  const isDispatchQueueRecord = (record) => isWorkingRecord(record);
  const isClosedQueueRecord = (record) => isClosedRecord(record) && !isArchivedRecord(record);
  const isArchivedQueueRecord = (record) => isArchivedRecord(record);

  const responderConsoleRecords = useMemo(() => {
    return records.filter((record) => !record.archived_at && record.status !== "closed");
  }, [records]);

  const responderSelectedRecord = useMemo(() => {
    if (responderConsoleRecords.length === 0) return null;
    return (
      responderConsoleRecords.find((record) => record.id === selectedRecordId) ||
      responderConsoleRecords[0]
    );
  }, [responderConsoleRecords, selectedRecordId]);

  const responderSelectedAssignments = useMemo(() => {
    if (!responderSelectedRecord) return [];
    return safeArray(assignmentsByRecordId[responderSelectedRecord.id]);
  }, [assignmentsByRecordId, responderSelectedRecord]);

  const currentResponderAssignment = useMemo(() => {
    const currentResponderRow = currentResponderRows[0];
    if (!currentResponderRow || !responderSelectedRecord) return null;

    return responderSelectedAssignments.find(
      (assignment) => assignment.responder_id === currentResponderRow.id
    ) || null;
  }, [currentResponderRows, responderSelectedAssignments, responderSelectedRecord]);

  const visibleDetailTabs =
    activeNav === "Responder Interface"
      ? currentResponderAssignment
        ? ["Overview", "Notes"]
        : ["Overview"]
      : canDispatch
      ? detailTabs
      : ["Overview"];

  const capacityZones = useMemo(
    () => safeArray(responderCapacity?.zones),
    [responderCapacity]
  );

  const defaultCapacityZoneId = useMemo(() => {
    if (responderSelectedRecord?.zone_id != null) {
      return String(responderSelectedRecord.zone_id);
    }

    const currentResponderRow = currentResponderRows[0];
    const firstResponderZoneId = safeArray(currentResponderRow?.zone_ids)[0];
    if (firstResponderZoneId != null) {
      return String(firstResponderZoneId);
    }

    if (capacityZones[0]?.zone_id != null) {
      return String(capacityZones[0].zone_id);
    }

    return "";
  }, [capacityZones, currentResponderRows, responderSelectedRecord]);

  const effectiveCapacityZoneId = selectedCapacityZoneId || defaultCapacityZoneId;

  return {
    capacityZones,
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
  };
}
