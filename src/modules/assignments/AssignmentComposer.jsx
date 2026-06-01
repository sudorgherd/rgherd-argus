import { useMemo, useState } from "react";
import { createAssignment } from "./assignmentsApi";

export default function AssignmentComposer({ recordId, responders, assignments, onCreated }) {
  const [responderId, setResponderId] = useState("");
  const [dispatcherNote, setDispatcherNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const assignedResponderIds = useMemo(
    () => new Set((assignments || []).map((assignment) => assignment.responder_id)),
    [assignments]
  );

  const eligibleResponders = useMemo(
    () =>
      (responders || []).filter(
        (responder) =>
          responder.is_active &&
          !assignedResponderIds.has(responder.id)
      ),
    [responders, assignedResponderIds]
  );

  async function handleSubmit(event) {
    event.preventDefault();

    if (!responderId) {
      setError("Select a responder.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const created = await createAssignment(recordId, {
        responder_id: Number(responderId),
        dispatcher_note: dispatcherNote.trim() || null,
      });

      setResponderId("");
      setDispatcherNote("");

      if (created?.matrix_send_result?.ok) {
        setMessage("Responder assigned. Matrix DM sent.");
      } else if (created?.matrix_send_result) {
        const reason =
          created.matrix_send_result.reason ||
          created.matrix_send_result.detail ||
          "Matrix send failed";
        setMessage(`Responder assigned. Matrix DM issue: ${reason}`);
      } else {
        setMessage("Responder assigned.");
      }

      if (onCreated) onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/55 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Assign Responder</p>

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

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Responder
        </label>
        <select
          value={responderId}
          onChange={(event) => setResponderId(event.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
        >
          <option value="">Select responder</option>
          {eligibleResponders.map((responder) => (
            <option key={responder.id} value={responder.id}>
              {responder.display_name || responder.subject_id || `Responder ${responder.id}`} — {responder.availability}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-200">
          Dispatcher Note
        </label>
        <textarea
          rows="3"
          value={dispatcherNote}
          onChange={(event) => setDispatcherNote(event.target.value)}
          disabled={saving}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
          placeholder="Optional note for assignment"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
        >
          {saving ? "Assigning..." : "Assign Responder"}
        </button>
      </div>
    </form>
  );
}
