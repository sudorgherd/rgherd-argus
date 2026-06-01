import { Users } from "lucide-react";

import { availabilityTone, presenceTone } from "../../constants/ui";
import { formatDateTime, responderLabel, safeArray } from "../../utils/display";
import { Panel } from "../../components/ui";

export default function ResponderPanel({
  responders,
  currentSubjectId,
  availabilitySaving,
  onUpdateAvailability,
}) {
  const availabilityOptions = ["Available", "Busy", "Away"];
  const currentResponder =
    responders.find((responder) => responder.subject_id === currentSubjectId) || responders[0] || null;

  return (
    <Panel title="My Status" subtitle="Responder availability" icon={Users} className="max-w-xl">
      {!currentResponder ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-400">
          No responder state returned yet.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">{responderLabel(currentResponder)}</p>
              <p className="mt-1 text-slate-400">
                {currentResponder.role} · {currentResponder.is_active ? "Active" : "Inactive"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 ${presenceTone[currentResponder.presence] || presenceTone.Offline}`}>
                {currentResponder.presence || "Offline"}
              </span>
              <span className={`rounded-full border px-2 py-0.5 ${availabilityTone[currentResponder.availability] || availabilityTone.Away}`}>
                {currentResponder.availability}
              </span>
            </div>
          </div>

          <p className="mt-2 text-slate-300">
            Skills: {safeArray(currentResponder.skills).length > 0 ? currentResponder.skills.join(", ") : "—"}
          </p>
          <p className="mt-1 text-slate-400">
            Updated: {formatDateTime(currentResponder.updated_at)}
          </p>

          <div className="mt-3 border-t border-slate-800 pt-3">
            <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              Update availability
            </p>
            <div className="flex flex-wrap gap-2">
              {availabilityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={availabilitySaving || currentResponder.availability === option}
                  onClick={() => onUpdateAvailability(option)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    currentResponder.availability === option
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100"
                      : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
