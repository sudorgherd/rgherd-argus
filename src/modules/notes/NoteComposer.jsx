import { useState } from "react";
import { createNote } from "./notesApi";

export default function NoteComposer({
  recordId,
  onCreated,
  allowVisibilitySelect = true,
  defaultVisibility = "internal",
}) {
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState(defaultVisibility);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!body.trim()) {
      setError("Note body is required.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const created = await createNote(recordId, {
        body: body.trim(),
        visibility,
      });

      setBody("");
      setVisibility(defaultVisibility);
      setMessage("Note added.");
      if (onCreated) onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/55 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Add Note</p>

      {(error || message) && (
        <div
          className={`rounded-lg border px-3 py-3 text-sm ${
            error
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || message}
        </div>
      )}

        {allowVisibilitySelect && (
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            >
              <option value="internal">Dispatch/Admin only</option>
              <option value="responder">Responder-visible</option>
            </select>
          </div>
        )}

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Note
        </label>
        <textarea
          rows="4"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
          placeholder="Add operational note"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
        >
          {saving ? "Adding..." : "Add Note"}
        </button>
      </div>
    </form>
  );
}
