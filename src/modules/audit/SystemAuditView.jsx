import { Panel } from "../../components/ui";
import { formatDateTime } from "../../utils/display";

export default function SystemAuditView({ systemAuditEvents }) {
  return (
    <section className="grid gap-4 xl:grid-cols-1">
      <Panel
        title="System Audit"
        subtitle="Dispatch / admin governance and system-level audit events"
      >
        {!systemAuditEvents.length ? (
          <div className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-4 text-sm text-slate-300">
            No system audit events yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
                <tr className="border-b border-slate-800">
                  <th className="px-3 py-3">Time</th>
                  <th className="px-3 py-3">Event</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Actor</th>
                  <th className="px-3 py-3">Responder</th>
                  <th className="px-3 py-3">Record</th>
                  <th className="px-3 py-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {systemAuditEvents.map((event) => (
                  <tr key={event.id} className="border-b border-slate-900 align-top">
                    <td className="px-3 py-3 whitespace-nowrap text-slate-300">
                      {formatDateTime(event.created_at)}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-100">
                      {event.event_type}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs uppercase tracking-[0.12em] text-slate-200">
                        {event.severity || "unknown"}
                      </span>
                    </td>
                    <td className="px-3 py-3 break-all text-slate-300">
                      {event.actor_id || "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {event.related_responder_id ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-300">
                      {event.related_record_id ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-400">
                      <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-400">
                        {JSON.stringify(event.event_metadata ?? {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </section>
  );
}
