import { Link2 } from "lucide-react";

import { Panel } from "./ui";

export default function MatrixIntegrationStatusPanel({ responders, zones, alertResult, matrixStatus }) {
  const respondersWithMatrix =
    matrixStatus?.responders_with_matrix_user_ids ?? responders.filter((responder) => responder.matrix_user_id).length;
  const activeRespondersWithMatrix =
    matrixStatus?.active_responders_with_matrix_user_ids ?? responders.filter((responder) => responder.is_active && responder.matrix_user_id).length;
  const respondersWithDmCache =
    matrixStatus?.responders_with_cached_dm_rooms ?? responders.filter((responder) => responder.dm_room_id).length;
  const zonesWithMatrix =
    matrixStatus?.zones_with_matrix_room_ids ?? zones.filter((zone) => zone.matrix_room_id).length;
  const activeZonesWithMatrix =
    matrixStatus?.active_zones_with_matrix_room_ids ?? zones.filter((zone) => zone.is_active && zone.matrix_room_id).length;

  return (
    <Panel
      title="Matrix / Integration Status"
      subtitle="Routing readiness and last result"
      icon={Link2}
      className="flex h-[420px] min-h-[420px] flex-col"
    >
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Service status</p>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span>Configuration</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  matrixStatus?.configured
                    ? "bg-emerald-500/15 text-emerald-200"
                    : "bg-rose-500/15 text-rose-200"
                }`}
              >
                {matrixStatus?.configured ? "Configured" : "Not Configured"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span>Bot check</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  matrixStatus?.whoami_ok
                    ? "bg-emerald-500/15 text-emerald-200"
                    : matrixStatus?.configured
                      ? "bg-amber-500/15 text-amber-200"
                      : "bg-slate-700 text-slate-300"
                }`}
              >
                {matrixStatus?.whoami_ok ? "Connected" : matrixStatus?.configured ? "Check Failed" : "Unavailable"}
              </span>
            </div>
            <p>Sender: {matrixStatus?.whoami_user_id || matrixStatus?.sender_user_id || "—"}</p>
            {matrixStatus?.whoami_error && (
              <p className="break-words text-amber-300">Bot Check Error: {matrixStatus.whoami_error}</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Routing readiness</p>
          <div className="mt-3 space-y-2">
            <p>Zones with Matrix room IDs: {zonesWithMatrix}</p>
            <p>Active zones with Matrix room IDs: {activeZonesWithMatrix}</p>
            <p>Responders with Matrix user IDs: {respondersWithMatrix}</p>
            <p>Active responders with Matrix user IDs: {activeRespondersWithMatrix}</p>
            <p>Responders with cached DM rooms: {respondersWithDmCache}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/55 px-3 py-3 text-sm text-slate-300">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Last send result</p>
          <p className="mt-2">
            {alertResult
              ? `${alertResult.success_count} delivered / ${alertResult.failure_count} failed`
              : "No manual alert sent this session."}
          </p>
        </div>
      </div>
    </Panel>
  );
}
