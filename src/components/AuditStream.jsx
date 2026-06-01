import { Activity } from "lucide-react";

import { formatDateTime, formatLabel } from "../utils/display";
import { Panel } from "./ui";

export default function AuditStream({ auditEvents }) {
  function asObject(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function renderMatrixDetails(event) {
    const meta = asObject(event.event_metadata);

    if (event.event_type === "matrix_manual_alert_sent") {
      const destination = meta.destination ? formatLabel(meta.destination) : "Manual alert";
      const results = Array.isArray(meta.results) ? meta.results : [];
      const preview = results.slice(0, 3);

      return (
        <div className="mt-1 space-y-1 text-slate-400">
          <p>
            Manual alert • {destination} • {meta.success_count ?? 0} delivered / {meta.failure_count ?? 0} failed
          </p>
          {preview.map((item, idx) => {
            const label =
              item.target_type === "responder"
                ? item.display_name || item.matrix_user_id || `Responder #${item.responder_id ?? "?"}`
                : item.zone_name || `Zone #${item.zone_id ?? "?"}`;

            return (
              <p key={`${event.id}-matrix-manual-${idx}`} className="text-slate-500">
                {item.ok ? "Delivered" : "Failed"} • {label}
                {item.reason ? ` • ${item.reason}` : ""}
              </p>
            );
          })}
          {results.length > 3 && (
            <p className="text-slate-500">+{results.length - 3} more target results</p>
          )}
        </div>
      );
    }

    if (event.event_type === "matrix_zone_auto_send") {
      return (
        <div className="mt-1 space-y-1 text-slate-400">
          <p>
            {(meta.ok ? "Zone alert delivered" : "Zone alert failed")}
            {meta.zone_name ? ` • ${meta.zone_name}` : ""}
          </p>
          {meta.reason && <p className="text-slate-500">Reason: {meta.reason}</p>}
          {meta.detail && <p className="text-slate-500 break-words">Detail: {meta.detail}</p>}
        </div>
      );
    }

    if (event.event_type === "matrix_assignment_auto_send") {
      return (
        <div className="mt-1 space-y-1 text-slate-400">
          <p>
            {(meta.ok ? "Assignment DM delivered" : "Assignment DM failed")}
            {meta.responder_id ? ` • Responder #${meta.responder_id}` : ""}
          </p>
          {meta.matrix_user_id && <p className="text-slate-500">Matrix User: {meta.matrix_user_id}</p>}
          {meta.reason && <p className="text-slate-500">Reason: {meta.reason}</p>}
          {meta.detail && <p className="text-slate-500 break-words">Detail: {meta.detail}</p>}
        </div>
      );
    }

    return null;
  }

  return (
    <Panel
      title="Selected Record Audit"
      subtitle="Live audit feed for current selection"
      icon={Activity}
      className="flex h-[420px] min-h-[420px] flex-col"
    >
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="space-y-2 text-xs text-slate-300">
          {auditEvents.length === 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/65 px-3 py-2.5 text-sm text-slate-400">
              No audit events loaded.
            </div>
          )}
          {auditEvents.map((event, index) => (
            <div key={event.id} className="flex gap-2 rounded-lg border border-slate-800 bg-slate-900/65 px-3 py-2.5">
              <span className="mt-0.5 text-slate-500">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p>{formatLabel(event.event_type)}</p>
                {renderMatrixDetails(event)}
                <p className="mt-1 text-slate-500">{formatDateTime(event.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
