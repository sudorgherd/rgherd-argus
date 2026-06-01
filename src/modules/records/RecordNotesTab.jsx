import { formatDateTime, formatLabel } from "../../utils/display";

export default function RecordNotesTab({
  notes,
  onOpenAddNote,
  onOpenNotesHistory,
}) {
  return (
    <div className="h-full overflow-y-auto pr-1">
      <div className="rounded-xl border border-slate-800 bg-slate-950/55 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Notes</p>
            <p className="mt-2 text-sm text-slate-400">
              Recent appended notes only. Initial intake details appear in Overview under Intake Notes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenAddNote}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100"
            >
              Add Note
            </button>
            <button
              type="button"
              onClick={onOpenNotesHistory}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
            >
              View All Notes
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {notes.length === 0 ? (
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
              No appended notes yet. Use Add Note to create the first appended note.
            </div>
          ) : (
            notes.slice(0, 3).map((note) => {
              const preview =
                note.body.length > 180 ? `${note.body.slice(0, 180).trimEnd()}…` : note.body;

              return (
                <div
                  key={note.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-300"
                >
                  <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                    {note.author_role} • {formatLabel(note.visibility)} • {formatDateTime(note.created_at)}
                  </p>
                  <p>{preview}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
