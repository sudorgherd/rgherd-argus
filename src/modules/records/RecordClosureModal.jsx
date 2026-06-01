const closureOutcomeOptions = [
  "resolved",
  "referred",
  "unable_to_complete",
  "duplicate",
  "cancelled",
  "other",
];

export default function RecordClosureModal({
  closing,
  closureError,
  followUpNeeded,
  needMet,
  onClose,
  onFollowUpNeededChange,
  onNeedMetChange,
  onOutcomeNotesChange,
  onOutcomeTypeChange,
  onRespondersInvolvedChange,
  onSubmit,
  open,
  outcomeNotes,
  outcomeType,
  record,
  respondersInvolved,
  saving,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Closure</p>
            <h3 className="mt-2 text-lg font-semibold text-slate-100">Close Record #{record.id}</h3>
            <p className="mt-2 text-sm text-slate-400">
              Resolve operational work first, then complete structured closure.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={closing}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>

        {closureError && (
          <div className="mt-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-sm text-rose-200">
            {closureError}
          </div>
        )}

        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Outcome Type
            </label>
            <select
              value={outcomeType}
              onChange={(event) => onOutcomeTypeChange(event.target.value)}
              disabled={saving || closing}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="">Select outcome type</option>
              {closureOutcomeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Outcome Notes
            </label>
            <textarea
              rows="5"
              value={outcomeNotes}
              onChange={(event) => onOutcomeNotesChange(event.target.value)}
              disabled={saving || closing}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
              placeholder="Summarize what happened and how the record concluded"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Responders Involved
            </label>
            <input
              type="text"
              value={respondersInvolved}
              onChange={(event) => onRespondersInvolvedChange(event.target.value)}
              disabled={saving || closing}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
              placeholder="Comma-separated names or identifiers"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={needMet}
                onChange={(event) => onNeedMetChange(event.target.checked)}
                disabled={saving || closing}
              />
              <span className="text-sm text-slate-200">Need met</span>
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={followUpNeeded}
                onChange={(event) => onFollowUpNeededChange(event.target.checked)}
                disabled={saving || closing}
              />
              <span className="text-sm text-slate-200">Follow-up needed</span>
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || closing}
            className="rounded-lg border border-sky-400/40 bg-sky-500/15 px-4 py-2 text-sm font-medium text-sky-100 disabled:opacity-60"
          >
            {closing ? "Closing..." : "Submit Closure"}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={closing}
            className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
