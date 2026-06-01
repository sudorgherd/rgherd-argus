import { formatDateTime, formatLabel, responderLabel } from "../../utils/display";

export default function RecordAuditTab({
  auditEvents,
  responderMap,
}) {
  return (
    <div className="h-full overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/55 p-4 pr-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Audit trail</p>
      <div className="mt-4 space-y-2">
        {auditEvents.length === 0 && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-400">
            No audit events yet.
          </div>
        )}

        {auditEvents.map((event) => {
          const meta =
            event.event_metadata && typeof event.event_metadata === "object"
              ? event.event_metadata
              : {};
          const changes =
            meta.changes && typeof meta.changes === "object" ? meta.changes : {};
          const changeEntries = Object.entries(changes);
          const auditResponder =
            meta.responder_id != null ? responderMap.get(meta.responder_id) : null;
          const auditResponderName =
            meta.responder_id != null
              ? responderLabel(auditResponder, meta.responder_id)
              : null;
          const isMatrixDelivery = event.event_type === "matrix_assignment_auto_send";
          const deliveryLabel = isMatrixDelivery ? (meta.ok ? "Delivered" : "Failed") : null;

          return (
            <div
              key={event.id}
              className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-3 text-sm text-slate-300"
            >
              <p className="font-medium text-slate-100">{formatLabel(event.event_type)}</p>
              <p className="mt-1 text-xs text-slate-400">
                Actor: {event.actor_id || "—"} • {formatDateTime(event.created_at)}
              </p>

              {(auditResponderName || meta.assignment_id || meta.assignment_state || isMatrixDelivery) && (
                <div className="mt-2 space-y-1 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                  {auditResponderName && (
                    <p>
                      <span className="text-slate-500">Responder:</span>{" "}
                      <span className="text-slate-100">{auditResponderName}</span>
                    </p>
                  )}

                  {meta.assignment_id != null && (
                    <p>
                      <span className="text-slate-500">Assignment:</span>{" "}
                      <span className="text-slate-100">#{meta.assignment_id}</span>
                    </p>
                  )}

                  {meta.assignment_state && (
                    <p>
                      <span className="text-slate-500">State:</span>{" "}
                      <span className="text-slate-100">{formatLabel(meta.assignment_state)}</span>
                    </p>
                  )}

                  {meta.cleared_at && (
                    <p>
                      <span className="text-slate-500">Cleared:</span>{" "}
                      <span className="text-slate-100">{formatDateTime(meta.cleared_at)}</span>
                    </p>
                  )}

                  {meta.dispatcher_note && (
                    <p>
                      <span className="text-slate-500">Dispatcher note:</span>{" "}
                      <span className="text-slate-100">{meta.dispatcher_note}</span>
                    </p>
                  )}

                  {isMatrixDelivery && (
                    <>
                      <p>
                        <span className="text-slate-500">Matrix DM:</span>{" "}
                        <span className={meta.ok ? "text-emerald-300" : "text-rose-300"}>
                          {deliveryLabel}
                        </span>
                      </p>

                      {meta.matrix_user_id && (
                        <p>
                          <span className="text-slate-500">Matrix user:</span>{" "}
                          <span className="text-slate-100">{meta.matrix_user_id}</span>
                        </p>
                      )}

                      <p>
                        <span className="text-slate-500">Room:</span>{" "}
                        <span className="text-slate-100">
                          {meta.used_cached_room ? "Cached DM room" : "New DM room"}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              )}

              {changeEntries.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs text-slate-300">
                  {changeEntries.map(([field, change]) => (
                    <p key={`${event.id}-${field}`}>
                      <span className="text-slate-500">{formatLabel(field)}:</span>{" "}
                      <span className="text-slate-400">{String(change?.from ?? "—")}</span>
                      <span className="text-slate-500"> → </span>
                      <span className="text-slate-100">{String(change?.to ?? "—")}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
