import { useState } from "react";
import { Activity } from "lucide-react";

import CategoryBadge from "../../components/CategoryBadge";
import { DetailStat, Panel, Tag } from "../../components/ui";
import { detailTabs, severityTone, statusTone } from "../../constants/ui";
import { escalationLabel, formatDateTime, formatLabel, responderLabel, zoneLabel } from "../../utils/display";
import RecordAuditTab from "./RecordAuditTab";
import RecordNotesTab from "./RecordNotesTab";
import RecordOverviewTab from "./RecordOverviewTab";
import RecordDetailModals from "./RecordDetailModals";

export default function SelectedRecordPanel({
  record,
  assignments,
  responderMap,
  notes,
  auditEvents,
  activeTab,
  onTabChange,
  detailLoading,
  onRecordUpdated,
  onNoteCreated,
  onAssignmentCreated,
  onAssignmentDeleted,
  zones = [],
  isAdmin = false,
  canDispatch = false,
}) {
  const [deletingAssignmentId, setDeletingAssignmentId] = useState(null);
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [addNoteOpen, setAddNoteOpen] = useState(false);
  const [notesHistoryOpen, setNotesHistoryOpen] = useState(false);

  if (!record) {
    return (
      <Panel
        title="Selected Record"
        subtitle="Focused detail panel for operator review"
        icon={Activity}
        className="flex h-[860px] min-h-[860px] flex-col"
      >
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
          No record selected.
        </div>
      </Panel>
    );
  }

  const assignedNames = assignments.map(
    (assignment) => responderLabel(responderMap.get(assignment.responder_id), assignment.responder_id)
  );
  const canMutateAssignments = record.status !== "closed" && !record.archived_at;

  async function handleUnassignClick(assignment) {
    if (!onAssignmentDeleted) return;

    try {
      setDeletingAssignmentId(assignment.id);
      await onAssignmentDeleted(assignment);
    } finally {
      setDeletingAssignmentId(null);
    }
  }

  function handleAssignmentCreatedLocal(createdAssignment) {
    setAssignmentOpen(false);
    if (onAssignmentCreated) onAssignmentCreated(createdAssignment);
  }

  return (
    <Panel
      title="Selected Record"
      subtitle="Focused detail panel for operator review"
      icon={Activity}
      className="flex h-[860px] min-h-[860px] flex-col"
    >
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
              <p className="text-xs text-slate-500">
                #{record.id} · {zoneLabel(record.zone_id, zones)} · {record.category || "Uncategorized"}
              </p>
            <h4 className="mt-3 text-xl font-semibold text-slate-100">{record.summary}</h4>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {record.location || "No location captured yet."}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2">
            {record.active_response && (
              <Tag className="!border-amber-300 !bg-amber-500/30 text-[11px] !text-amber-50 shadow-[0_0_14px_rgba(245,158,11,0.22)]">
                  {escalationLabel(record)}
              </Tag>
            )}
            <span className={`rounded-full border px-2.5 py-1 text-xs ${statusTone[record.status] || statusTone.new}`}>
              {formatLabel(record.status)}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs ${severityTone[record.severity] || severityTone.Low}`}>
              {record.severity || "—"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DetailStat label="Verification" value={formatLabel(record.verification_state)} />
          <DetailStat label="Created" value={formatDateTime(record.created_at)} />
          <DetailStat label="Updated" value={formatDateTime(record.updated_at || record.created_at)} />
          <DetailStat
            label="Assignments"
            value={assignedNames.length > 0 ? assignedNames.join(", ") : "Awaiting assignment"}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {detailTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              activeTab === tab
                ? "border border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                : "border border-slate-800 bg-slate-900/70 text-slate-300 hover:bg-slate-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-4 flex-1 overflow-hidden">
        {detailLoading && (
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3 text-sm text-slate-400">
            Loading selected-record detail…
          </div>
        )}

        {activeTab === "Overview" && (
          <RecordOverviewTab
            assignments={assignments}
            canDispatch={canDispatch}
            canMutateAssignments={canMutateAssignments}
            deletingAssignmentId={deletingAssignmentId}
            isAdmin={isAdmin}
            onOpenAssign={() => setAssignmentOpen(true)}
            onRecordUpdated={onRecordUpdated}
            onUnassign={handleUnassignClick}
            record={record}
            responderMap={responderMap}
          />
        )}

        {activeTab === "Notes" && (
          <RecordNotesTab
            notes={notes}
            onOpenAddNote={() => setAddNoteOpen(true)}
            onOpenNotesHistory={() => setNotesHistoryOpen(true)}
          />
        )}

        {activeTab === "Audit" && (
          <RecordAuditTab auditEvents={auditEvents} responderMap={responderMap} />
        )}

      </div>

      <RecordDetailModals
        addNoteOpen={addNoteOpen}
        assignmentOpen={assignmentOpen}
        assignments={assignments}
        notes={notes}
        notesHistoryOpen={notesHistoryOpen}
        onAssignmentCreated={handleAssignmentCreatedLocal}
        onCloseAddNote={() => setAddNoteOpen(false)}
        onCloseAssignment={() => setAssignmentOpen(false)}
        onCloseNotesHistory={() => setNotesHistoryOpen(false)}
        onNoteCreated={(createdNote) => {
          setAddNoteOpen(false);
          if (onNoteCreated) onNoteCreated(createdNote);
        }}
        record={record}
        responderMap={responderMap}
      />

    </Panel>
  );
}
