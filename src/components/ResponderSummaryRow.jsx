import { safeArray } from "../utils/display";

export default function ResponderSummaryRow({
  records,
  currentResponderId,
  assignmentsByRecordId,
  capacity,
  selectedZoneId,
  onSelectZone,
}) {
  const zones = safeArray(capacity?.zones);
  const overall = capacity?.overall || { online: 0, available: 0 };
  const selectedZone =
    zones.find((zone) => String(zone.zone_id) === String(selectedZoneId)) ||
    zones[0] ||
    null;

  const myAssignmentCount = records.filter((record) =>
    safeArray(assignmentsByRecordId[record.id]).some(
      (assignment) => assignment.responder_id === currentResponderId
    )
  ).length;

  const zoneViewCount = records.length - myAssignmentCount;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-slate-800 bg-panel/95 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">My Assignments</p>
        <p className="mt-2 text-2xl font-semibold text-slate-100">{myAssignmentCount}</p>
        <p className="mt-2 text-xs text-slate-400">Assigned to me</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-panel/95 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Zone View</p>
        <p className="mt-2 text-2xl font-semibold text-slate-100">{zoneViewCount}</p>
        <p className="mt-2 text-xs text-slate-400">Visible zone records</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-panel/95 p-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Overall Capacity</p>
        <p className="mt-2 text-2xl font-semibold text-slate-100">
          {overall.online ?? 0}/{overall.available ?? 0}
        </p>
        <p className="mt-2 text-xs text-slate-400">Online / available</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-panel/95 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Zone Capacity</p>
          <select
            value={selectedZone?.zone_id ?? ""}
            onChange={(event) => onSelectZone(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 outline-none"
          >
            {zones.length === 0 ? (
              <option value="">No zones</option>
            ) : (
              zones.map((zone) => (
                <option key={zone.zone_id} value={zone.zone_id}>
                  {zone.zone_name}
                </option>
              ))
            )}
          </select>
        </div>
        <p className="mt-2 text-2xl font-semibold text-slate-100">
          {selectedZone?.online ?? 0}/{selectedZone?.available ?? 0}
        </p>
        <p className="mt-2 text-xs text-slate-400">{selectedZone?.zone_name || "No zone selected"} · Online / available</p>
      </div>
    </section>
  );
}
