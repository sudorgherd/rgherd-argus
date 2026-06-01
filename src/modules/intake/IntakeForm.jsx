import { useState } from "react";
import { createRecord } from "./intakeApi";

const initialForm = {
  summary: "",
  category: "Safety / Threat / Health",
  severity: "Low",
  verification_state: "pending",
  source_type: "dispatcher_observation",
  professional_escalation: "",
  active_response: false,
  location: "",
  zone_id: "",
  internal_notes_summary: "",
};

export default function IntakeForm({ onCreated, zones = [] }) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [escalationModalOpen, setEscalationModalOpen] = useState(false);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setError("");
    setMessage("");
  }

  function needsProfessionalEscalation() {
    return (
      form.category === "Safety / Threat / Health" &&
      form.active_response === true
    );
  }

  function shouldPromptForProfessionalEscalation(nextActiveResponse) {
    return (
      form.category === "Safety / Threat / Health" &&
      form.active_response === false &&
      nextActiveResponse === true &&
      !form.professional_escalation
    );
  }

  function handleActiveResponseChange(nextChecked) {
    if (shouldPromptForProfessionalEscalation(nextChecked)) {
      setEscalationModalOpen(true);
      setError("");
      setMessage("");
      return;
    }

    updateField("active_response", nextChecked);
  }

  function handleProfessionalEscalationChoice(choice) {
    setForm((current) => ({
      ...current,
      active_response: true,
      professional_escalation: choice,
    }));
    setEscalationModalOpen(false);
    setError("");
    setMessage("");
  }

  function handleEscalationCancel() {
    setForm((current) => ({
      ...current,
      active_response: false,
      professional_escalation: "",
    }));
    setEscalationModalOpen(false);
    setError("");
    setMessage("");
  }

  function validateForm() {
    if (!form.summary.trim()) {
      return "Summary is required.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        summary: form.summary.trim(),
        category: form.category,
        severity: form.severity,
        active_response: form.active_response,
        verification_state: form.verification_state,
        source_type: form.source_type,
        professional_escalation: form.professional_escalation || null,
        location: form.location.trim() || null,
        zone_id: form.zone_id === "" ? null : Number(form.zone_id),
        internal_notes_summary: form.internal_notes_summary.trim() || null,
      };

      const created = await createRecord(payload);
      setMessage(`Record #${created.id} created successfully.`);
      setForm(initialForm);
      if (onCreated) onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create record.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm(initialForm);
    setError("");
    setMessage("");
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {(error || message) && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            error
              ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Summary
          </label>
          <input
            type="text"
            value={form.summary}
            onChange={(event) => updateField("summary", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            placeholder="Brief operational summary"
            disabled={saving}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Category
          </label>
          <select
            value={form.category}
            onChange={(event) => updateField("category", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            disabled={saving}
          >
            <option>Safety / Threat / Health</option>
            <option>Basic Needs (Shelter / Food / Supplies)</option>
            <option>Escort / Transport</option>
            <option>Legal Support / Observer</option>
            <option>Logistics / Coordination</option>
            <option>Other Support</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Severity
          </label>
          <select
            value={form.severity}
            onChange={(event) => updateField("severity", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            disabled={saving}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
            <option>Critical</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Verification
          </label>
          <select
            value={form.verification_state}
            onChange={(event) => updateField("verification_state", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            disabled={saving}
          >
            <option>pending</option>
            <option>unverified</option>
            <option>verified</option>
            <option>not_applicable</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Source Type
          </label>
          <select
            value={form.source_type}
            onChange={(event) => updateField("source_type", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            disabled={saving}
          >
            <option value="dispatcher_observation">Responder Observation</option>
            <option value="matrix_message">Matrix Message</option>
            <option value="phone_call">Phone Call</option>
            <option value="walk_up">Walk-Up</option>
            <option value="external_report">External Report</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3">
          <input
            type="checkbox"
            id="active_response"
            className="h-4 w-4"
            checked={form.active_response}
            onChange={(event) => handleActiveResponseChange(event.target.checked)}
            disabled={saving}
          />
          <label htmlFor="active_response" className="text-sm text-slate-200">
            Escalate this record?
          </label>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Zone
          </label>
          <select
            value={form.zone_id}
            onChange={(event) => updateField("zone_id", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            disabled={saving}
          >
            <option value="">No zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Location
          </label>
          <input
            type="text"
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            placeholder="Optional location or area"
            disabled={saving}
          />
        </div>

        <div className="xl:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            Internal Notes
          </label>
          <textarea
            rows="5"
            value={form.internal_notes_summary}
            onChange={(event) => updateField("internal_notes_summary", event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none"
            placeholder="Internal intake notes"
            disabled={saving}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
        >
          {saving ? "Creating..." : "Create Record"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>

      {escalationModalOpen && (
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
                onClick={() => handleProfessionalEscalationChoice("yes")}
                disabled={saving}
                className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm font-medium text-rose-100 disabled:opacity-60"
              >
                Yes
              </button>

              <button
                type="button"
                onClick={() => handleProfessionalEscalationChoice("no")}
                disabled={saving}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
              >
                No
              </button>

              <button
                type="button"
                onClick={() => handleProfessionalEscalationChoice("unknown")}
                disabled={saving}
                className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-100 disabled:opacity-60"
              >
                Unknown
              </button>

                <button
                  type="button"
                  onClick={handleEscalationCancel}
                  disabled={saving}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 disabled:opacity-60"
                >
                  Cancel
                </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
