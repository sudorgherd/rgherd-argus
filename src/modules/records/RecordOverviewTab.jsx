import { formatDateTime, formatLabel, responderLabel } from "../../utils/display";
import RecordActions from "./RecordActions";

export default function RecordOverviewTab({
  assignments,
  canDispatch,
  canMutateAssignments,
  deletingAssignmentId,
  isAdmin,
  onOpenAssign,
  onRecordUpdated,
  onUnassign,
  record,
  responderMap,
}) {
  return (
    <div className="h-full space-y-4 overflow-y-auto pr-1">
      <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4 pr-3">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Operational Snapshot</p>
        <div className="mt-3 space-y-3 text-sm text-slate-300">
          <div>
            <p className="text-xs text-slate-500">Escalated</p>
            <p className="mt-1 text-slate-100">{record.active_response ? "On" : "Off"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Professional escalation</p>
            <p className="mt-1 text-slate-100">{formatLabel(record.professional_escalation)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Responder instructions</p>
            <p className="mt-1 text-slate-100">{record.responder_instructions || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Intake Notes</p>
            <p className="mt-1 text-slate-100">{record.internal_notes_summary || "—"}</p>
          </div>
        </div>
      </div>

      <RecordActions
        record={record}
        onUpdated={onRecordUpdated}
        onOpenAssign={onOpenAssign}
        isAdmin={isAdmin}
        canDispatch={canDispatch}
      />

      <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Assignment snapshot</p>
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          {assignments.length === 0 && <p className="text-slate-400">No assignments yet.</p>}

          {assignments.map((assignment) => {
            const responder = responderMap.get(assignment.responder_id);

            return (
              <div
                key={assignment.id}
                className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3"
              >
                <p className="font-medium text-slate-100">
                  {responderLabel(responder, assignment.responder_id)}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`rounded-full border px-2 py-0.5 ${
                      assignment.assignment_state === "cleared"
                        ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                        : assignment.assignment_state === "active"
                        ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                        : "border-amber-400/40 bg-amber-500/15 text-amber-100"
                    }`}
                  >
                    {formatLabel(assignment.assignment_state)}
                  </span>

                  <span className="text-slate-400">
                    Assigned: {formatDateTime(assignment.assigned_at)}
                  </span>

                  {assignment.cleared_at && (
                    <span className="text-slate-400">
                      Cleared: {formatDateTime(assignment.cleared_at)}
                    </span>
                  )}
                </div>

                {assignment.dispatcher_note && (
                  <p className="mt-2 text-xs text-slate-300">{assignment.dispatcher_note}</p>
                )}

                {canMutateAssignments && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => onUnassign(assignment)}
                      disabled={deletingAssignmentId === assignment.id}
                      className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 disabled:opacity-60"
                    >
                      {deletingAssignmentId === assignment.id ? "Unassigning..." : "Unassign"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
