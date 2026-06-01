import { useEffect, useState } from "react";
import { archiveRecord, closeRecord, purgeRecord, reopenRecord, updateRecord } from "./recordsApi";
import RecordClosureModal from "./RecordClosureModal";
import RecordEscalationModal from "./RecordEscalationModal";

const statusOptions = [
  "new",
  "under_review",
  "notified",
  "assigned",
  "resolved",
];

const verificationOptions = [
  "pending",
  "unverified",
  "verified",
  "not_applicable",
];


export default function RecordActions({
  record,
  onUpdated,
  onOpenAssign,
  isAdmin = false,
  canDispatch = false,
}) {
  const [status, setStatus] = useState(record?.status || "new");
  const [verification, setVerification] = useState(record?.verification_state || "pending");
  const [activeResponse, setActiveResponse] = useState(Boolean(record?.active_response));
  const [professionalEscalation, setProfessionalEscalation] = useState(record?.professional_escalation || "");
  const [escalationModalOpen, setEscalationModalOpen] = useState(false);
  const [outcomeType, setOutcomeType] = useState(record?.outcome_type || "");
  const [outcomeNotes, setOutcomeNotes] = useState(record?.outcome_notes || "");
  const [respondersInvolved, setRespondersInvolved] = useState(
    Array.isArray(record?.responders_involved) ? record.responders_involved.join(", ") : ""
  );
  const [needMet, setNeedMet] = useState(record?.need_met ?? true);
  const [followUpNeeded, setFollowUpNeeded] = useState(record?.follow_up_needed ?? false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [error, setError] = useState("");
  const [closureError, setClosureError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setStatus(record?.status || "new");
    setVerification(record?.verification_state || "pending");
    setActiveResponse(Boolean(record?.active_response));
    setProfessionalEscalation(record?.professional_escalation || "");
    setEscalationModalOpen(false);
    setOutcomeType(record?.outcome_type || "");
    setOutcomeNotes(record?.outcome_notes || "");
    setRespondersInvolved(
      Array.isArray(record?.responders_involved) ? record.responders_involved.join(", ") : ""
    );
    setNeedMet(record?.need_met ?? true);
    setFollowUpNeeded(record?.follow_up_needed ?? false);
    setClosureOpen(false);
    setError("");
    setClosureError("");
    setMessage("");
  }, [
    record?.id,
    record?.status,
    record?.verification_state,
    record?.active_response,
    record?.outcome_type,
    record?.outcome_notes,
    record?.responders_involved,
    record?.need_met,
    record?.follow_up_needed,
  ]);

  if (!record) return null;

  function shouldPromptForProfessionalEscalation(nextActiveResponse) {
    return (
      record?.category === "Safety / Threat / Health" &&
      Boolean(record?.active_response) === false &&
      nextActiveResponse === true &&
      !record?.professional_escalation &&
      !professionalEscalation
    );
  }

  function handleActiveResponseChange(nextChecked) {
    if (shouldPromptForProfessionalEscalation(nextChecked)) {
      setEscalationModalOpen(true);
      setError("");
      setMessage("");
      return;
    }

    setActiveResponse(nextChecked);
  }

  function handleProfessionalEscalationChoice(choice) {
    setProfessionalEscalation(choice);
    setActiveResponse(true);
    setEscalationModalOpen(false);
    setError("");
    setMessage("");
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const updated = await updateRecord(record.id, {
        status,
        verification_state: verification,
        active_response: activeResponse,
        professional_escalation: professionalEscalation || null,
      });

      setMessage("Record updated.");
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update record.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    setClosing(true);
    setClosureError("");
    setMessage("");

    try {
      const updated = await closeRecord(record.id, {
        outcome_type: outcomeType.trim(),
        outcome_notes: outcomeNotes.trim(),
        responders_involved: respondersInvolved
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        need_met: needMet,
        follow_up_needed: followUpNeeded,
      });

      setMessage("Record closed.");
      setClosureOpen(false);
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setClosureError(err instanceof Error ? err.message : "Failed to close record.");
    } finally {
      setClosing(false);
    }
  }

  async function handleReopen() {
    setReopening(true);
    setError("");
    setMessage("");

    try {
      const updated = await reopenRecord(record.id, {});
      setMessage("Record reopened.");
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen record.");
    } finally {
      setReopening(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    setError("");
    setMessage("");

    try {
      const updated = await archiveRecord(record.id, {});
      setMessage("Record archived.");
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive record.");
    } finally {
      setArchiving(false);
    }
  }

  async function handlePurge() {
    const confirmed = window.confirm(
      `Permanently delete archived record #${record.id} and its related data from ARGUS? This cannot be undone.`
    );
    if (!confirmed) return;

    setPurging(true);
    setError("");
    setMessage("");

    try {
      await purgeRecord(record.id);
      setMessage("Record purged.");
      if (onUpdated) onUpdated({ id: record.id, purged: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to purge record.");
    } finally {
      setPurging(false);
    }
  }

  const isArchived = Boolean(record?.archived_at);
  const isClosed = record?.status === "closed" && !isArchived;
  const canEditRecord = canDispatch && !isClosed && !isArchived;
  const canShowClose = canEditRecord;
  const canShowReopen = canDispatch && isClosed;
  const canShowArchive = isAdmin && isClosed;
  const canShowPurge = isAdmin && isArchived;

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Dispatcher Actions</p>

        {(error || message) && (
          <div
            className={`mt-3 rounded-lg border px-3 py-3 text-sm ${
              error
                ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            }`}
          >
            {error || message}
          </div>
        )}

          {canEditRecord ? (
            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  disabled={saving || closing}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
                >
                  {statusOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Verification
                </label>
                <select
                  value={verification}
                  onChange={(event) => setVerification(event.target.value)}
                  disabled={saving || closing}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
                >
                  {verificationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
                <input
                  type="checkbox"
                  id="record_active_response"
                  className="h-4 w-4"
                  checked={activeResponse}
                  onChange={(event) => handleActiveResponseChange(event.target.checked)}
                  disabled={saving || closing}
                />
                <label htmlFor="record_active_response" className="text-sm text-slate-200">
                  Escalate this record?
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-3 text-sm text-slate-400">
              Record fields are read-only in this lifecycle state.
            </div>
          )}

        <div className="mt-4 flex flex-wrap gap-3">
          {canEditRecord && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || closing || reopening || archiving || purging}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Record Updates"}
            </button>
          )}

          {canEditRecord && onOpenAssign && (
            <button
              type="button"
              onClick={onOpenAssign}
              disabled={saving || closing || reopening || archiving || purging}
              className="rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-4 py-2 text-sm font-medium text-indigo-100 disabled:opacity-60"
            >
              Assign Responder
            </button>
          )}

          {canShowClose && (
            <button
              type="button"
              onClick={() => setClosureOpen(true)}
              disabled={saving || closing || reopening || archiving || purging}
              className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 disabled:opacity-60"
            >
              Close Record
            </button>
          )}

          {canShowReopen && (
            <button
              type="button"
              onClick={handleReopen}
              disabled={saving || closing || reopening || archiving || purging}
              className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-60"
            >
              {reopening ? "Reopening..." : "Reopen Record"}
            </button>
          )}

          {canShowArchive && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={saving || closing || reopening || archiving || purging}
              className="rounded-lg border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-100 disabled:opacity-60"
            >
              {archiving ? "Archiving..." : "Archive Record"}
            </button>
          )}

          {canShowPurge && (
            <button
              type="button"
              onClick={handlePurge}
              disabled={saving || closing || reopening || archiving || purging}
              className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-100 disabled:opacity-60"
            >
              {purging ? "Purging..." : "Purge Record"}
            </button>
          )}
        </div>
      </div>

      <RecordEscalationModal
        closing={closing}
        onChoice={handleProfessionalEscalationChoice}
        open={escalationModalOpen}
        saving={saving}
      />

      <RecordClosureModal
        closing={closing}
        closureError={closureError}
        followUpNeeded={followUpNeeded}
        needMet={needMet}
        onClose={() => setClosureOpen(false)}
        onFollowUpNeededChange={setFollowUpNeeded}
        onNeedMetChange={setNeedMet}
        onOutcomeNotesChange={setOutcomeNotes}
        onOutcomeTypeChange={setOutcomeType}
        onRespondersInvolvedChange={setRespondersInvolved}
        onSubmit={handleClose}
        open={closureOpen}
        outcomeNotes={outcomeNotes}
        outcomeType={outcomeType}
        record={record}
        respondersInvolved={respondersInvolved}
        saving={saving}
      />
    </>
  );
}
