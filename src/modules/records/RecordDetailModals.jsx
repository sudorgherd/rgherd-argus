import AssignmentComposer from "../assignments/AssignmentComposer";
import NoteComposer from "../notes/NoteComposer";
import { formatDateTime, formatLabel } from "../../utils/display";

export default function RecordDetailModals({
  addNoteOpen,
  assignmentOpen,
  assignments,
  notes,
  notesHistoryOpen,
  onAssignmentCreated,
  onCloseAddNote,
  onCloseAssignment,
  onCloseNotesHistory,
  onNoteCreated,
  record,
  responderMap,
}) {
  return (
    <>
      {addNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Notes</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-100">Add Note to Record #{record.id}</h3>
              </div>

              <button
                type="button"
                onClick={onCloseAddNote}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-5">
              <NoteComposer
                recordId={record.id}
                onCreated={onNoteCreated}
              />
            </div>
          </div>
        </div>
      )}

      {notesHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Notes</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-100">Record #{record.id} Notes</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Full appended note history.
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseNotesHistory}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                {notes.length === 0 && (
                  <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
                    No appended notes yet. Initial intake details appear in Overview under Intake Notes.
                  </div>
                )}

                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-300"
                  >
                    <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      {note.author_role} • {formatLabel(note.visibility)} • {formatDateTime(note.created_at)}
                    </p>
                    <p>{note.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {assignmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Assignment</p>
                <h3 className="mt-2 text-lg font-semibold text-slate-100">Assign Responder to Record #{record.id}</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Add a responder to the active record.
                </p>
              </div>

              <button
                type="button"
                onClick={onCloseAssignment}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                Cancel
              </button>
            </div>

            <div className="mt-5">
              <AssignmentComposer
                recordId={record.id}
                responders={Array.from(responderMap.values())}
                assignments={assignments}
                onCreated={onAssignmentCreated}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
