import { Users } from "lucide-react";

import { availabilityTone, presenceTone } from "../constants/ui";
import { formatDateTime, responderLabel, safeArray } from "../utils/display";
import { Panel } from "./ui";

function presenceRank(presence) {
  if (presence === "Online") return 0;
  if (presence === "Idle") return 1;
  return 2;
}

function lastSeenText(lastSeenAt) {
  if (!lastSeenAt) return "—";

  const seen = new Date(lastSeenAt);
  if (Number.isNaN(seen.getTime())) return "—";

  const minutes = Math.max(0, Math.round((Date.now() - seen.getTime()) / 60000));

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1m ago";
  if (minutes < 60) return `${minutes}m ago`;

  return formatDateTime(lastSeenAt);
}

function profileText(responder) {
  const capabilities = [];

  if (responder.is_admin) capabilities.push("Admin");
  if (responder.can_dispatch) capabilities.push("Dispatch");
  if (responder.can_respond) capabilities.push("Respond");

  if (capabilities.length > 0) return capabilities.join(" / ");

  return responder.role || "No operational access";
}

function compactList(values) {
  const list = safeArray(values);
  return list.length > 0 ? list.join(", ") : "—";
}

export default function ActiveRosterPanel({ responders }) {
  const sortedResponders = [...responders].sort((a, b) => {
    const aRank = presenceRank(a.presence);
    const bRank = presenceRank(b.presence);

    if (aRank !== bRank) return aRank - bRank;

    return (a.display_name || a.subject_id || "").localeCompare(b.display_name || b.subject_id || "");
  });

  const onlineCount = sortedResponders.filter((responder) => responder.presence === "Online").length;
  const idleCount = sortedResponders.filter((responder) => responder.presence === "Idle").length;
  const offlineCount = sortedResponders.filter((responder) => responder.presence === "Offline" || !responder.presence).length;

  return (
    <Panel
      title="Active Roster"
      subtitle="All registered responders, effective presence first"
      icon={Users}
      className="flex h-[860px] min-h-[860px] flex-col"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
          Total: {sortedResponders.length}
        </span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
          Online: {onlineCount}
        </span>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-200">
          Idle: {idleCount}
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-slate-300">
          Offline: {offlineCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/40">
        <div className="grid grid-cols-[minmax(190px,1.2fr)_120px_130px_minmax(150px,1fr)_minmax(180px,1.2fr)_110px] gap-4 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          <div>Name / Profile</div>
          <div>Presence</div>
          <div>Availability</div>
          <div>Zones</div>
          <div>Skills</div>
          <div className="text-right">Last Seen</div>
        </div>

        {sortedResponders.length === 0 && (
          <div className="px-4 py-6 text-sm text-slate-400">
            No responders returned yet.
          </div>
        )}

        <div className="divide-y divide-slate-800/80">
          {sortedResponders.map((responder) => {
            const isOffline = responder.presence === "Offline" || !responder.presence;
            const isIdle = responder.presence === "Idle";

            return (
              <div
                key={responder.id}
                className={`grid grid-cols-[minmax(190px,1.2fr)_120px_130px_minmax(150px,1fr)_minmax(180px,1.2fr)_110px] items-center gap-4 px-4 py-3 text-xs transition hover:bg-slate-900/70 ${
                  isOffline
                    ? "text-slate-500 opacity-75"
                    : isIdle
                      ? "bg-amber-500/[0.03]"
                      : "text-slate-300"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-100">{responderLabel(responder)}</p>
                  <p className="mt-1 truncate text-slate-500">
                    {profileText(responder)}
                    {responder.is_active ? "" : " · Inactive"}
                  </p>
                </div>

                <div>
                  <span className={`rounded-full border px-2 py-0.5 ${presenceTone[responder.presence] || presenceTone.Offline}`}>
                    {responder.presence || "Offline"}
                  </span>
                </div>

                <div>
                  <span className={`rounded-full border px-2 py-0.5 ${availabilityTone[responder.availability] || availabilityTone.Away}`}>
                    {responder.availability || "—"}
                  </span>
                </div>

                <p className="truncate text-slate-400" title={compactList(responder.zones)}>
                  {compactList(responder.zones)}
                </p>

                <p className="truncate text-slate-300" title={compactList(responder.skills)}>
                  {compactList(responder.skills)}
                </p>

                <p className="text-right text-slate-500">
                  {lastSeenText(responder.last_seen_at)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}
