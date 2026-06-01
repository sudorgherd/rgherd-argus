import { CheckCircle2 } from "lucide-react";

import { escalationLabel, formatDateTime, formatLabel, safeArray, zoneLabel } from "../utils/display";
import { Panel } from "./ui";

export default function ResponderQueuePanel({
  records,
  assignmentsByRecordId,
  currentResponderId,
  selectedRecordId,
  onSelect,
  loading,
  zones = [],
}) {
  return (
    <Panel
      title="Responder Queue"
      subtitle="Assigned and zone-visible responder records"
      icon={CheckCircle2}
      className="flex h-[720px] min-h-[720px] flex-col"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
          Visible: {records.length}
        </span>
        <span className="ml-auto text-slate-500">Responder-visible records only</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
        <div className="h-full overflow-y-auto pb-4">
          {loading && (
            <div className="px-4 py-6 text-sm text-slate-400">Loading assigned records…</div>
          )}

          {!loading && records.length === 0 && (
            <div className="px-4 py-6 text-sm text-slate-400">
              No assigned records returned yet.
            </div>
          )}

          {records.map((record) => {
            const isSelected = selectedRecordId === record.id;
            const myAssignment = safeArray(assignmentsByRecordId?.[record.id]).find(
              (assignment) => assignment.responder_id === currentResponderId
            );

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
                  <span>{formatDateTime(record.updated_at || record.created_at)}</span>
                  {myAssignment && (
                    <span className={`rounded-full border px-2 py-0.5 ${
                      myAssignment.assignment_state === "cleared"
                        ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                        : myAssignment.assignment_state === "active"
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                        : "border-amber-400/40 bg-amber-500/15 text-amber-100"
                    }`}>
                      My State: {formatLabel(myAssignment.assignment_state)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
