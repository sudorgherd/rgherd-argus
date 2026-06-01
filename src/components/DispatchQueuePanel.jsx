import { Siren } from "lucide-react";

import { escalationLabel, formatDateTime, formatLabel, responderLabel, safeArray, zoneLabel } from "../utils/display";
import { Panel } from "./ui";

export default function DispatchQueuePanel({
  records,
  assignmentsByRecordId,
  responderMap,
  selectedRecordId,
  onSelect,
  loading,
  zones = [],
  mode = "dispatch_queue",
}) {
  const panelTitle =
    mode === "active_incidents"
      ? "Active Queue"
      : mode === "closed_records"
      ? "Closed Records"
      : mode === "archived_records"
      ? "Archived Records"
      : "Dispatch Queue";

  const panelSubtitle =
    mode === "active_incidents"
      ? "Escalated records or records with responders currently active"
      : mode === "closed_records"
      ? "Closed records awaiting admin review"
      : mode === "archived_records"
      ? "Archived records in chronological review"
      : "All open, non-closed operational records";

  const getTime = (record, field) => {
    const value = record?.[field];
    const timestamp = value ? Date.parse(value) : 0;
    return Number.isNaN(timestamp) ? 0 : timestamp;
  };

  const sortedRecords = [...records].sort((a, b) => {
    if (mode === "closed_records") {
      return getTime(a, "closed_at") - getTime(b, "closed_at") || a.id - b.id;
    }

    if (mode === "archived_records") {
      return getTime(a, "archived_at") - getTime(b, "archived_at") || a.id - b.id;
    }

    return (
      getTime(b, "updated_at") - getTime(a, "updated_at") ||
      getTime(b, "created_at") - getTime(a, "created_at") ||
      b.id - a.id
    );
  });

  const sortLabel =
    mode === "closed_records"
      ? "Sorted by closed_at asc, then id asc"
      : mode === "archived_records"
      ? "Sorted by archived_at asc, then id asc"
      : "Sorted by updated_at desc, then id desc";

  const queueCountLabel =
    mode === "active_incidents"
      ? "Active records"
      : mode === "closed_records"
      ? "Closed records"
      : mode === "archived_records"
      ? "Archived records"
      : "Open records";

  const responderStateLabel =
    mode === "active_incidents" ? "Responder State" : "Assignment";

  return (
    <Panel
      title={panelTitle}
      subtitle={panelSubtitle}
      icon={Siren}
      className="flex h-[860px] min-h-[860px] flex-col"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{queueCountLabel}: {sortedRecords.length}</span>
        <span className="ml-auto text-slate-500">{sortLabel}</span>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="max-h-[640px] space-y-2 overflow-y-auto p-2">
          {loading && <div className="px-4 py-6 text-sm text-slate-400">Loading live records…</div>}

          {!loading && records.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400">No records returned yet.</div>
          )}

          {sortedRecords.map((record) => {
            const isSelected = selectedRecordId === record.id;
            const assignments = safeArray(assignmentsByRecordId[record.id]);
            const assignedNames = assignments
              .map((assignment) =>
                responderLabel(responderMap.get(assignment.responder_id), assignment.responder_id)
              )
              .join(", ");

            const responderStates = [
              ...new Set(
                assignments
                  .map((assignment) => assignment.assignment_state)
                  .filter(Boolean)
              ),
            ];

            const responderStatusLabel =
              responderStates.length === 0
                ? ""
                : responderStates.length === 1
                ? responderStates[0]
                : "mixed";

            const activityTime =
              mode === "closed_records"
                ? record.closed_at || record.updated_at || record.created_at
                : mode === "archived_records"
                ? record.archived_at || record.closed_at || record.updated_at || record.created_at
                : record.updated_at || record.created_at;

            return (
              <button
                key={record.id}
                type="button"
                onClick={() => onSelect(record.id)}
                className={`w-full border-t border-slate-800 px-4 py-3 text-left transition first:border-t-0 hover:bg-slate-900/70 ${
                  isSelected ? "bg-slate-900/80" : "bg-transparent"
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span className="font-semibold text-slate-100">#{record.id}</span>
                  <span>·</span>
                  <span>{zoneLabel(record.zone_id, zones)}</span>
                  <span>·</span>
                  <span>{record.category || "Uncategorized"}</span>
                  {record.active_response && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-amber-200">{escalationLabel(record)}</span>
                    </>
                  )}
                </div>

                <p className="mt-2 text-sm font-medium text-slate-200">{record.summary}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                  <span>{record.severity || "—"}</span>
                  <span>·</span>
                  <span>{formatLabel(record.status)}</span>
                  <span>·</span>
                  <span>{activityTime ? formatDateTime(activityTime) : "—"}</span>
                  <span>·</span>
                  <span>
                    {responderStateLabel}:{" "}
                    <span className="text-slate-300">
                      {responderStatusLabel ? formatLabel(responderStatusLabel) : "Awaiting assignment"}
                    </span>
                  </span>
                  <span>·</span>
                  <span>
                    Assigned: <span className="text-slate-300">{assignedNames || "Unassigned"}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
