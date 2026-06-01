import { AlertTriangle } from "lucide-react";

import { responderLabel, zoneLabel } from "../utils/display";
import { Panel } from "./ui";

export default function AlertsPanel({
  record,
  responders,
  zones,
  alertDestination,
  onAlertDestinationChange,
  alertResponderId,
  onAlertResponderIdChange,
  alertZoneId,
  onAlertZoneIdChange,
  alertNote,
  onAlertNoteChange,
  alertSending,
  onSendAlert,
  onRetryLastAlert,
  alertResult,
  canRetryAlert,
}) {
  const responderOptions = responders
    .filter((responder) => responder.matrix_user_id)
    .sort((a, b) => responderLabel(a).localeCompare(responderLabel(b)));

  const zoneOptions = zones
    .filter((zone) => zone.is_active)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const requiresResponder = alertDestination === "one_responder";
  const requiresZone = alertDestination === "one_zone";

  function getResultLabel(item) {
    if (item.target_type === "responder") {
      return (
        item.display_name ||
        item.matrix_user_id ||
        (item.responder_id ? `Responder #${item.responder_id}` : "Responder")
      );
    }

    if (item.target_type === "zone") {
      return (
        item.zone_name ||
        (item.zone_id ? `Zone #${item.zone_id}` : "Zone")
      );
    }

    return "Target";
  }

  return (
    <Panel
      title="Alerts"
      subtitle="Record-linked Matrix sends"
      icon={AlertTriangle}
      className="flex h-[420px] min-h-[420px] flex-col"
    >
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {!record ? (
          <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/40 px-3 py-4 text-sm text-slate-400">
            Select a record to send an alert.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Selected record</p>
              <p className="mt-2 text-sm font-medium text-slate-100">#{record.id} — {record.summary}</p>
              <p className="mt-1 text-xs text-slate-400">
                {record.category || "—"} • {record.severity || "—"} • {zoneLabel(record.zone_id, zones)}
              </p>
            </div>

            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Destination</label>
              <select
                value={alertDestination}
                onChange={(event) => onAlertDestinationChange(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
              >
                <option value="one_responder">One Responder</option>
                <option value="all_online_responders">All Online Responders</option>
                <option value="all_responders">All Responders</option>
                <option value="one_zone">One Zone</option>
                <option value="all_zones">All Zones</option>
              </select>
            </div>

            {requiresResponder && (
              <div>
                <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Responder</label>
                <select
                  value={alertResponderId}
                  onChange={(event) => onAlertResponderIdChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select responder</option>
                  {responderOptions.map((responder) => (
                    <option key={responder.id} value={String(responder.id)}>
                      {responderLabel(responder)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {requiresZone && (
              <div>
                <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Zone</label>
                <select
                  value={alertZoneId}
                  onChange={(event) => onAlertZoneIdChange(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                >
                  <option value="">Select zone</option>
                  {zoneOptions.map((zone) => (
                    <option key={zone.id} value={String(zone.id)}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-[0.14em] text-slate-500">Dispatcher Note</label>
              <textarea
                value={alertNote}
                onChange={(event) => onAlertNoteChange(event.target.value)}
                className="mt-2 min-h-[120px] w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100"
                placeholder="Optional note to append to the alert"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                Sends the selected record payload through the ARGUS Matrix service account.
              </p>
              <div className="flex items-center gap-2">
                {canRetryAlert && (
                  <button
                    type="button"
                    onClick={onRetryLastAlert}
                    disabled={alertSending}
                    className="rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-100 disabled:opacity-60"
                  >
                    {alertSending ? "Sending..." : "Retry Failed Send"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSendAlert}
                  disabled={alertSending}
                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-100 disabled:opacity-60"
                >
                  {alertSending ? "Sending..." : "Send Alert"}
                </button>
              </div>
            </div>

            {alertResult && (
              <div
                className={`rounded-lg border px-3 py-3 text-sm ${
                  alertResult.ok
                    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    : "border-amber-400/30 bg-amber-500/10 text-amber-100"
                }`}
              >
                <p className="font-medium">
                  {alertResult.ok
                    ? `Alert sent: ${alertResult.success_count} success, ${alertResult.failure_count} failure.`
                    : `Alert result: ${alertResult.success_count} success, ${alertResult.failure_count} failure.`}
                </p>

                <p className="mt-1 text-xs opacity-80">
                  See Selected Record Audit for detailed Matrix send history.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
