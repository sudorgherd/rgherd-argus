import { safeArray } from "../utils/display";

export default function SummaryRow({ records, responders, mode = "dispatch_queue", assignmentsByRecordId = {} }) {
  const watchCount = records.filter((record) =>
    ["under_review", "notified", "assigned"].includes(record.status)
  ).length;
  const criticalCount = records.filter((record) => record.severity === "Critical").length;
  const availableCount = responders.filter((responder) => responder.availability === "Available").length;
  const activeResponseCount = records.filter((record) => record.active_response).length;
  const responderActiveCount = records.filter((record) =>
    safeArray(assignmentsByRecordId[record.id]).some(
      (assignment) => assignment.assignment_state === "active"
    )
  ).length;
  const resolvedCount = records.filter((record) => record.status === "resolved").length;
  const closedCount = records.filter((record) => record.status === "closed").length;

  let items = [
    { label: "Open Records", value: String(records.length), context: "Total open records" },
    { label: "Escalated", value: String(activeResponseCount), context: "Escalation flag on" },
    { label: "Open Work", value: String(watchCount), context: "Under review / notified / assigned" },
    { label: "Critical", value: String(criticalCount), context: "Highest-severity records" },
    { label: "Responders", value: `${availableCount}/${responders.length}`, context: "Available / total" },
  ];

  if (mode === "dispatch_console") {
    items = [
      { label: "Active Records", value: String(records.length), context: "Escalated / active" },
      { label: "Escalated", value: String(activeResponseCount), context: "Escalation flag on" },
      { label: "Active Responses", value: String(responderActiveCount), context: "Responders currently engaged" },
      { label: "Critical", value: String(criticalCount), context: "Highest-severity live work" },
      { label: "Responders", value: `${availableCount}/${responders.length}`, context: "Available / total" },
    ];
  } else if (mode === "incident_records") {
    items = [
      { label: "Closed", value: String(closedCount), context: "Historical records in view" },
      { label: "Critical", value: String(criticalCount), context: "Closed critical records" },
      { label: "Resolved", value: String(resolvedCount), context: "Resolved before closure" },
      { label: "Responders", value: `${availableCount}/${responders.length}`, context: "Available / total" },
    ];
  } else if (mode === "archived_records") {
    items = [
      { label: "Archived", value: String(records.length), context: "Archived records in view" },
      { label: "Critical", value: String(criticalCount), context: "Archived critical records" },
      { label: "Closed", value: String(closedCount), context: "Closed before archive" },
      { label: "Responders", value: `${availableCount}/${responders.length}`, context: "Available / total" },
    ];
  }

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-slate-800 bg-panel/95 p-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{item.value}</p>
          <p className="mt-2 text-xs text-slate-400">{item.context}</p>
        </div>
      ))}
    </section>
  );
}
