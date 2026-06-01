export default function RecordEscalationModal({
  closing,
  onChoice,
  open,
  saving,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-amber-500/30 bg-slate-950 p-5 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.14em] text-amber-300/80">
          Potential Emergency
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-100">
          Professional escalation check
        </h3>
        <p className="mt-3 text-sm text-slate-300">
          You are marking this event as an urgent safety-related incident.
          If there is immediate danger, an active threat, or a serious medical emergency,
          contact 911 or appropriate emergency services.
        </p>
        <p className="mt-4 text-sm font-medium text-slate-200">
          Is professional escalation needed?
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onChoice("yes")}
            disabled={saving || closing}
            className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-100 disabled:opacity-60"
          >
            Yes
          </button>

          <button
            type="button"
            onClick={() => onChoice("no")}
            disabled={saving || closing}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
          >
            No
          </button>

          <button
            type="button"
            onClick={() => onChoice("unknown")}
            disabled={saving || closing}
            className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-60"
          >
            Unknown
          </button>
        </div>
      </div>
    </div>
  );
}
